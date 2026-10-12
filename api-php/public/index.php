<?php

declare(strict_types=1);

use Xandralyze\Accounts;
use Xandralyze\Auth;
use Xandralyze\Db;
use Xandralyze\Env;
use Xandralyze\Files;
use Xandralyze\Http;
use Xandralyze\Jwt;
use Xandralyze\Mail;
use Xandralyze\Repo;

// Admite dos formas de instalación:
//  1) public/ como raíz web y src/ + .env una carpeta por encima
//  2) todo (index.php, src/, .env) en la misma carpeta raíz del subdominio
$base = is_dir(__DIR__ . '/../src') ? __DIR__ . '/..' : __DIR__;

require $base . '/src/Env.php';
require $base . '/src/Http.php';
require $base . '/src/Jwt.php';
require $base . '/src/Auth.php';
require $base . '/src/Db.php';
require $base . '/src/Accounts.php';
require $base . '/src/Repo.php';

Env::load($base . '/.env');
Http::cors(Env::get('ALLOWED_ORIGINS', '') ?? '');


set_exception_handler(static function (Throwable $e): void {
    error_log('[api] ' . $e->getMessage());
    Http::fail('Error interno del servidor', 500, 'internal_error');
});

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^.*/api/v1#', '', $path) ?? '';
$segments = array_values(array_filter(explode('/', trim($path, '/')), fn (string $s): bool => $s !== ''));
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$db = new Db(
    Env::get('DB_HOST', 'localhost') ?? 'localhost',
    Env::get('DB_PORT', '3306') ?? '3306',
    Env::require('DB_NAME'),
    Env::require('DB_USER'),
    Env::get('DB_PASS', '') ?? '',
);

if ($segments === ['health']) {
    $db->one('SELECT 1 AS ok');
    Http::json(['ok' => true, 'time' => gmdate('c')]);
}

require $base . '/src/Files.php';
$filesRoot = Env::get('FILES_DIR', $base . '/storage') ?? ($base . '/storage');
$filesEarly = new Files($db, $filesRoot, Env::require('APP_TOKEN'));

// Enlace temporal firmado: no necesita la clave compartida, basta la firma.
//   GET  /api/v1/file/{token}  -> descarga
//   POST /api/v1/file/{token}  -> subida directa desde el navegador
if (($segments[0] ?? '') === 'file' && isset($segments[1])) {
    $token = implode('/', array_slice($segments, 1));
    [$bucket, $path, $mode] = $filesEarly->verify($token);
    if ($method === 'GET') {
        if ($mode !== 'read') {
            Http::fail('Enlace no válido', 403, 'bad_token');
        }
        $filesEarly->stream($bucket, $path);
    }
    if ($method === 'POST') {
        if ($mode !== 'write') {
            Http::fail('Enlace no válido', 403, 'bad_token');
        }
        $contents = file_get_contents('php://input');
        if (!is_string($contents) || $contents === '') {
            Http::fail('No se ha recibido ningún archivo', 400, 'empty_body');
        }
        $mime = (string) ($_SERVER['CONTENT_TYPE'] ?? 'application/octet-stream');
        Http::json(['data' => $filesEarly->put($bucket, $path, null, $contents, $mime)], 201);
    }
    Http::fail('Método no permitido', 405, 'method_not_allowed');
}

// ---- Pagos Redsys: notificación pública (la firma de Redsys la protege) ----
$redsysNotifyUrl = Env::get('REDSYS_NOTIFY_URL', 'https://api.xandralyze.com/api/v1/redsys/notification') ?? '';
if ($segments === ['redsys', 'notification'] && $method === 'POST') {
    require $base . '/src/Redsys.php';
    (new \Xandralyze\Redsys($db, $redsysNotifyUrl))->notification();
}

$jwtSecret = Env::get('AUTH_JWT_SECRET', '') ?? '';

$auth = new Auth(
    $_SERVER['HTTP_X_IDENTITY_URL'] ?? Env::get('SUPABASE_URL', '') ?? '',
    $_SERVER['HTTP_X_IDENTITY_KEY'] ?? Env::get('SUPABASE_ANON_KEY', '') ?? '',
    Env::require('APP_TOKEN'),
    $jwtSecret,
);
$auth->assertAppToken();
// Modo servicio: la propia aplicación (con la clave compartida) actúa sin
// usuario, igual que antes hacía con la clave de servicio de Lovable Cloud.
$service = ($_SERVER['HTTP_X_SERVICE'] ?? '') === '1';

// ---- Conexión en directo de grabaciones multicámara (sondeo) ----
if (($segments[0] ?? '') === 'relay' && isset($segments[1], $segments[2])) {
    require $base . '/src/Relay.php';
    (new \Xandralyze\Relay($db->pdo()))->handle($segments[1], $segments[2], $method);
}

// ---- Cuentas propias ----------------------------------------------------
if (($segments[0] ?? '') === 'auth') {
    if ($jwtSecret === '') {
        Http::fail('Las cuentas propias no están configuradas (falta AUTH_JWT_SECRET)', 503, 'auth_not_configured');
    }
    $accounts = new Accounts($db, new Jwt($jwtSecret));
    $action = $segments[1] ?? '';
    $sub = $segments[2] ?? '';
    if (count($segments) > 3 || ($sub !== '' && $action !== 'users')) {
        Http::fail('Ruta no válida', 404, 'unknown_route');
    }

    // ---- Administración de cuentas (rol admin o modo servicio) ----------
    if ($action === 'users') {
        if (!$service && !$accounts->hasRole($auth->userId(), 'admin')) {
            Http::fail('Solo para administración', 403, 'forbidden');
        }
        if ($method === 'GET' && $sub === '') {
            Http::json(['data' => $accounts->adminUsers()]);
        }
        if ($method === 'POST' && $sub === '') {
            Http::json(['data' => $accounts->adminCreate(Http::body())], 201);
        }
        if ($method === 'PATCH' && $sub === '') {
            Http::json(['data' => $accounts->adminUpdate(Http::body())]);
        }
        if ($method === 'POST' && $sub === 'password') {
            Http::json(['data' => $accounts->adminSetPassword(Http::body())]);
        }
        if ($method === 'POST' && $sub === 'delete') {
            Http::json(['data' => $accounts->adminDelete(Http::body())]);
        }
        if ($method === 'POST' && $sub === 'role') {
            Http::json(['data' => $accounts->setRole(Http::body())]);
        }
        Http::fail('Ruta no válida', 404, 'unknown_route');
    }


    // Acciones públicas (la app las llama con su clave compartida).
    if ($method === 'POST') {
        switch ($action) {
            case 'register':
                Http::json(['data' => $accounts->register(Http::body())], 201);
                // no break
            case 'login':
                Http::json(['data' => $accounts->login(Http::body())]);
                // no break
            case 'refresh':
                Http::json(['data' => $accounts->refresh(Http::body())]);
                // no break
            case 'logout':
                Http::json(['data' => $accounts->logout(Http::body())]);
                // no break
            case 'forgot':
                Http::json(['data' => $accounts->forgot(Http::body())]);
                // no break
            case 'reset':
                Http::json(['data' => $accounts->reset(Http::body())]);
                // no break
            case 'verify':
                Http::json(['data' => $accounts->verify(Http::body())]);
                // no break
            case 'import':
                if (!$service) {
                    Http::fail('Operación no permitida', 403, 'service_only');
                }
                Http::json(['data' => $accounts->import(Http::body())]);
                // no break
            case 'password':
                Http::json(['data' => $accounts->changePassword($auth->userId(), Http::body())]);
                // no break
        }
    }
    if ($method === 'GET' && $action === 'me') {
        Http::json(['data' => $accounts->me($auth->userId())]);
    }
    if ($method === 'PATCH' && $action === 'profile') {
        Http::json(['data' => $accounts->updateProfile($auth->userId(), Http::body())]);
    }

    Http::fail('Ruta no válida', 404, 'unknown_route');
}

$userId = $service ? null : $auth->userId();

// ---- Áreas de práctica y búsqueda de personas ----------------------------
//   GET /api/v1/areas | POST /api/v1/areas | DELETE /api/v1/areas/{id}
//   POST /api/v1/people/lookup  { email } | { ids: [] }
if (in_array($segments[0] ?? '', ['areas', 'people'], true)) {
    if ($userId === null) {
        Http::fail('Necesitas iniciar sesión', 401, 'unauthorized');
    }
    require $base . '/src/Extras.php';
    $extras = new \Xandralyze\Extras($db);
    if ($segments === ['areas'] && $method === 'GET') {
        Http::json(['data' => $extras->listAreas($userId)]);
    }
    if ($segments === ['areas'] && $method === 'POST') {
        Http::json(['data' => $extras->createArea($userId, Http::body())], 201);
    }
    if (($segments[0] ?? '') === 'areas' && count($segments) === 2 && $method === 'DELETE') {
        Http::json(['data' => $extras->deleteArea($userId, (string) $segments[1])]);
    }
    if ($segments === ['people', 'lookup'] && $method === 'POST') {
        Http::json(['data' => $extras->lookupPeople(Http::body())]);
    }
    Http::fail('Ruta no válida', 404, 'unknown_route');
}

// ---- Colaboración (proyecto de código abierto) ----------------------------
//   GET  /api/v1/contrib/me            (usuario)  estado y propuestas propias
//   POST /api/v1/contrib/request       (usuario)  solicitar ser colaborador
//   POST /api/v1/contrib/proposals     (colaborador aprobado) nueva propuesta
//   GET  /api/v1/contrib/admin         (admin)    todo
//   POST /api/v1/contrib/admin/decide  (admin)    aprobar / rechazar / ratificar
if (($segments[0] ?? '') === 'contrib') {
    if ($userId === null) {
        Http::fail('Necesitas iniciar sesión', 401, 'unauthorized');
    }
    require_once $base . '/src/Mail.php';
    require $base . '/src/Contrib.php';
    $smtpHost = Env::get('SMTP_HOST', '') ?? '';
    $mailer = $smtpHost !== '' ? new Mail(
        $smtpHost,
        (int) (Env::get('SMTP_PORT', '587') ?? '587'),
        Env::get('SMTP_USER', '') ?? '',
        Env::get('SMTP_PASS', '') ?? '',
    ) : null;
    $adminEmail = Env::get('ADMIN_NOTIFY_EMAIL', '') ?: (Env::get('SMTP_FROM', '') ?? '');
    $contrib = new \Xandralyze\Contrib($db, $mailer, (string) $adminEmail);
    $route = implode('/', array_slice($segments, 1));
    if ($route === 'me' && $method === 'GET') {
        Http::json(['data' => $contrib->me($userId)]);
    }
    if ($route === 'request' && $method === 'POST') {
        Http::json(['data' => $contrib->requestAccess($userId, Http::body())]);
    }
    if ($route === 'proposals' && $method === 'POST') {
        Http::json(['data' => $contrib->propose($userId, Http::body())], 201);
    }
    if ($route === 'admin' || $route === 'admin/decide') {
        $roleRow = $db->one('SELECT 1 AS ok FROM app_user_roles WHERE user_id = :id AND role = \'admin\'', ['id' => $userId]);
        if ($roleRow === null) {
            Http::fail('Solo para administración', 403, 'forbidden');
        }
        if ($route === 'admin' && $method === 'GET') {
            Http::json(['data' => $contrib->adminList()]);
        }
        if ($route === 'admin/decide' && $method === 'POST') {
            Http::json(['data' => $contrib->adminDecide($userId, Http::body())]);
        }
    }
    Http::fail('Ruta no válida', 404, 'unknown_route');
}

// ---- Redes sociales (solo administración) ---------------------------------
//   Admin:    GET/POST social/settings, GET social/settings/key,
//             GET/POST social/stories, GET/PATCH/DELETE social/stories/{id},
//             POST social/stories/{id}/chapters, PATCH/DELETE social/chapters/{id},
//             GET social/queue
//   Servicio: GET social/due, POST social/chapters/{id}/result
if (($segments[0] ?? '') === 'social') {
    require $base . '/src/Social.php';
    $social = new \Xandralyze\Social($db);
    $route = implode('/', array_slice($segments, 1));
    if ($service) {
        if ($route === 'due' && $method === 'GET') {
            Http::json(['data' => $social->due((int) ($_GET['limit'] ?? 20))]);
        }
        if (preg_match('#^chapters/([0-9a-f-]{36})/result$#', $route, $m) && $method === 'POST') {
            Http::json(['data' => $social->serviceResult($m[1], Http::body())]);
        }
        Http::fail('Ruta no válida', 404, 'unknown_route');
    }
    if ($userId === null) {
        Http::fail('Necesitas iniciar sesión', 401, 'unauthorized');
    }
    $isAdmin = $db->one('SELECT 1 AS ok FROM app_user_roles WHERE user_id = :id AND role = \'admin\'', ['id' => $userId]);
    if ($isAdmin === null) {
        Http::fail('Solo para administración', 403, 'forbidden');
    }
    if ($route === 'settings' && $method === 'GET') {
        Http::json(['data' => $social->settings($userId)]);
    }
    if ($route === 'settings' && $method === 'POST') {
        Http::json(['data' => $social->saveSettings($userId, Http::body())]);
    }
    if ($route === 'settings/key' && $method === 'GET') {
        Http::json(['data' => ['key' => $social->ayrshareKey($userId)]]);
    }
    if ($route === 'stories' && $method === 'GET') {
        Http::json(['data' => $social->listStories($userId)]);
    }
    if ($route === 'stories' && $method === 'POST') {
        Http::json(['data' => $social->createStory($userId, Http::body())], 201);
    }
    if ($route === 'queue' && $method === 'GET') {
        Http::json(['data' => $social->queue($userId)]);
    }
    if (preg_match('#^stories/([0-9a-f-]{36})(/chapters)?$#', $route, $m)) {
        $sid = $m[1];
        if (!empty($m[2]) && $method === 'POST') {
            Http::json(['data' => $social->addChapter($userId, $sid, Http::body())], 201);
        }
        if (empty($m[2]) && $method === 'GET') {
            Http::json(['data' => $social->getStory($userId, $sid)]);
        }
        if (empty($m[2]) && $method === 'PATCH') {
            Http::json(['data' => $social->updateStory($userId, $sid, Http::body())]);
        }
        if (empty($m[2]) && $method === 'DELETE') {
            Http::json(['data' => $social->deleteStory($userId, $sid)]);
        }
    }
    if (preg_match('#^chapters/([0-9a-f-]{36})$#', $route, $m)) {
        if ($method === 'PATCH') {
            Http::json(['data' => $social->updateChapter($userId, $m[1], Http::body())]);
        }
        if ($method === 'DELETE') {
            Http::json(['data' => $social->deleteChapter($userId, $m[1])]);
        }
    }
    Http::fail('Ruta no válida', 404, 'unknown_route');
}

// ---- Pagos Redsys ------------------------------------------------------
//   POST /api/v1/redsys/checkout | pay-extra  (usuario, o servicio con user_id)
//   POST /api/v1/redsys/charge-recurring      (solo servicio / tarea diaria)
if (($segments[0] ?? '') === 'redsys' && $method === 'POST' && count($segments) === 2) {
    require $base . '/src/Redsys.php';
    $redsys = new \Xandralyze\Redsys($db, $redsysNotifyUrl);
    $body = Http::body();
    $who = $userId ?? (string) ($body['user_id'] ?? '');
    switch ($segments[1]) {
        case 'charge-recurring':
            if (!$service) {
                Http::fail('Operación no permitida', 403, 'service_only');
            }
            Http::json(['data' => $redsys->chargeRecurring()]);
            // no break
        case 'checkout':
        case 'pay-extra':
            if (!preg_match('/^[0-9a-f-]{36}$/i', $who)) {
                Http::fail('Falta el usuario', 400, 'missing_user');
            }
            Http::json(['data' => $segments[1] === 'checkout' ? $redsys->checkout($who, $body) : $redsys->payExtra($who, $body)]);
    }
    Http::fail('Ruta no válida', 404, 'unknown_route');
}

// ---- Pasarela de IA -----------------------------------------------------
//   POST /api/v1/ai/chat/completions  (formato OpenAI; se reenvía a Gemini)
if (($segments[0] ?? '') === 'ai') {
    require $base . '/src/Ai.php';
    $ai = new \Xandralyze\Ai(
        Env::get('GEMINI_API_KEY', '') ?? '',
        Env::get('OPENAI_API_KEY', '') ?? '',
    );
    $ai->proxy(implode('/', array_slice($segments, 1)), $method);
}

// ---- Correo saliente (SMTP del hosting) ---------------------------------
//   POST /api/v1/email/send  { to, subject, html, text, reply_to? }
//   Solo modo servicio: la aplicación llama con su clave compartida.
if (($segments[0] ?? '') === 'email') {
    if (!$service) {
        Http::fail('Operación no permitida', 403, 'service_only');
    }
    if ($method === 'POST' && ($segments[1] ?? '') === 'send' && count($segments) === 2) {
        require_once $base . '/src/Mail.php';
        $mail = new Mail(
            Env::require('SMTP_HOST'),
            (int) (Env::get('SMTP_PORT', '587') ?? '587'),
            Env::get('SMTP_USER', '') ?? '',
            Env::get('SMTP_PASS', '') ?? '',
        );
        Http::json(['data' => $mail->send(Http::body())]);
    }
    Http::fail('Ruta no válida', 404, 'unknown_route');
}

// ---- Archivos ----------------------------------------------------------
$files = $filesEarly;

if (($segments[0] ?? '') === 'files') {
    // POST /api/v1/files/sign  { bucket, path, expires_in }
    if ($method === 'POST' && ($segments[1] ?? '') === 'sign' && count($segments) === 2) {
        $body = Http::body();
        $bucket = (string) ($body['bucket'] ?? '');
        if (!Files::isBucket($bucket)) {
            Http::fail('Contenedor no válido', 404, 'unknown_bucket');
        }
        $path = Files::cleanPath((string) ($body['path'] ?? ''));
        $mode = ($body['mode'] ?? 'read') === 'write' ? 'write' : 'read';
        $token = $files->sign($bucket, $path, (int) ($body['expires_in'] ?? 3600), $mode);
        Http::json(['data' => ['token' => $token, 'url' => '/api/v1/file/' . $token, 'mode' => $mode]]);
    }

    $bucket = $segments[1] ?? '';
    if (!Files::isBucket($bucket) || count($segments) < 3) {
        Http::fail('Ruta no válida', 404, 'unknown_route');
    }
    $path = Files::cleanPath(implode('/', array_slice($segments, 2)));

    if ($method === 'POST') {
        $contents = file_get_contents('php://input');
        if (!is_string($contents) || $contents === '') {
            Http::fail('No se ha recibido ningún archivo', 400, 'empty_body');
        }
        $mime = $_SERVER['CONTENT_TYPE'] ?? 'application/octet-stream';
        Http::json(['data' => $files->put($bucket, $path, $userId, $contents, (string) $mime)], 201);
    }
    if ($method === 'GET') {
        $files->stream($bucket, $path);
    }
    if ($method === 'DELETE') {
        Http::json(['data' => ['path' => $path, 'deleted' => $files->remove($bucket, $path)]]);
    }
    Http::fail('Método no permitido', 405, 'method_not_allowed');
}

$resource = $segments[0] ?? '';
$id = $segments[1] ?? null;

if ($resource === '' || !Repo::isResource($resource)) {
    Http::fail('Recurso no disponible', 404, 'unknown_resource');
}
if (count($segments) > 2) {
    Http::fail('Ruta no válida', 404, 'unknown_route');
}

$repo = new Repo($db);

switch ($method) {
    case 'GET':
        if ($id === null) {
            /** @var array<string,string> $query */
            $query = array_map('strval', $_GET);
            Http::json(['data' => $repo->list($resource, $userId, $query)]);
        }
        $row = $repo->find($resource, $userId, $id);
        if ($row === null) {
            Http::fail('No encontrado', 404, 'not_found');
        }
        Http::json(['data' => $row]);
        // no break

    case 'POST':
        if ($id !== null) {
            Http::fail('Ruta no válida', 404, 'unknown_route');
        }
        Http::json(['data' => $repo->create($resource, $userId, Http::body())], 201);
        // no break

    case 'PATCH':
        if ($id === null) {
            Http::fail('Falta el identificador', 400, 'missing_id');
        }
        Http::json(['data' => $repo->update($resource, $userId, $id, Http::body())]);
        // no break

    case 'DELETE':
        if ($id === null) {
            Http::fail('Falta el identificador', 400, 'missing_id');
        }
        $deleted = $repo->delete($resource, $userId, $id);
        if ($deleted === 0) {
            Http::fail('No encontrado', 404, 'not_found');
        }
        Http::json(['data' => ['id' => $id, 'deleted' => true]]);
        // no break

    default:
        Http::fail('Método no permitido', 405, 'method_not_allowed');
}
