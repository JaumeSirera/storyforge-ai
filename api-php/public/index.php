<?php

declare(strict_types=1);

use Xandralyze\Auth;
use Xandralyze\Db;
use Xandralyze\Env;
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
