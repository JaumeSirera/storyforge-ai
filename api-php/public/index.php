<?php

declare(strict_types=1);

use Xandralyze\Auth;
use Xandralyze\Db;
use Xandralyze\Env;
use Xandralyze\Files;
use Xandralyze\Http;
use Xandralyze\Repo;

// Admite dos formas de instalación:
//  1) public/ como raíz web y src/ + .env una carpeta por encima
//  2) todo (index.php, src/, .env) en la misma carpeta raíz del subdominio
$base = is_dir(__DIR__ . '/../src') ? __DIR__ . '/..' : __DIR__;

require $base . '/src/Env.php';
require $base . '/src/Http.php';
require $base . '/src/Auth.php';
require $base . '/src/Db.php';
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

$auth = new Auth(
    $_SERVER['HTTP_X_IDENTITY_URL'] ?? Env::get('SUPABASE_URL', '') ?? '',
    $_SERVER['HTTP_X_IDENTITY_KEY'] ?? Env::get('SUPABASE_ANON_KEY', '') ?? '',
    Env::require('APP_TOKEN'),
);
$auth->assertAppToken();
// Modo servicio: la propia aplicación (con la clave compartida) actúa sin
// usuario, igual que antes hacía con la clave de servicio de Lovable Cloud.
$service = ($_SERVER['HTTP_X_SERVICE'] ?? '') === '1';
$userId = $service ? null : $auth->userId();

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
