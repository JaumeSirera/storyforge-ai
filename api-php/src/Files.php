<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Almacenamiento de archivos en el propio servidor.
 *
 * Los ficheros se guardan fuera de la carpeta pública, en FILES_DIR, con la
 * estructura <contenedor>/<ruta>. Solo se sirven a través de la API, con la
 * clave compartida o con un enlace temporal firmado.
 */
final class Files
{
    /** Contenedores permitidos (equivalen a los de Lovable Cloud). */
    private const BUCKETS = ['assessments', 'branding', 'characters', 'participants', 'recordings', 'videos'];

    public function __construct(
        private Db $db,
        private string $root,
        private string $signingKey,
    ) {
    }

    public static function isBucket(string $bucket): bool
    {
        return in_array($bucket, self::BUCKETS, true);
    }

    /** Evita rutas con "..", barras iniciales o caracteres extraños. */
    public static function cleanPath(string $path): string
    {
        $path = str_replace('\\', '/', trim($path, '/'));
        $parts = [];
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.' || $part === '..') {
                continue;
            }
            $parts[] = preg_replace('/[^A-Za-z0-9._\- ]/', '_', $part) ?? '_';
        }
        if ($parts === []) {
            Http::fail('Ruta de archivo no válida', 400, 'bad_path');
        }
        return implode('/', $parts);
    }

    private function absolute(string $bucket, string $path): string
    {
        return rtrim($this->root, '/') . '/' . $bucket . '/' . $path;
    }

    /** Guarda el contenido recibido (cuerpo binario de la petición). */
    public function put(string $bucket, string $path, ?string $ownerId, string $contents, string $mime): array
    {
        $target = $this->absolute($bucket, $path);
        $dir = dirname($target);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            Http::fail('No se ha podido crear la carpeta de archivos', 500, 'mkdir_failed');
        }
        if (file_put_contents($target, $contents) === false) {
            Http::fail('No se ha podido guardar el archivo', 500, 'write_failed');
        }

        $existing = $this->db->one(
            'SELECT id FROM stored_files WHERE bucket = :b AND path = :p LIMIT 1',
            ['b' => $bucket, 'p' => $path],
        );
        $size = strlen($contents);
        if ($existing !== null) {
            $this->db->run(
                'UPDATE stored_files SET mime_type = :m, size_bytes = :s WHERE id = :id',
                ['m' => $mime, 's' => $size, 'id' => $existing['id']],
            );
            $id = (string) $existing['id'];
        } else {
            $id = Repo::uuid();
            $this->db->run(
                'INSERT INTO stored_files (id, bucket, path, owner_id, mime_type, size_bytes)
                 VALUES (:id, :b, :p, :o, :m, :s)',
                ['id' => $id, 'b' => $bucket, 'p' => $path, 'o' => $ownerId, 'm' => $mime, 's' => $size],
            );
        }

        return ['id' => $id, 'bucket' => $bucket, 'path' => $path, 'size_bytes' => $size, 'mime_type' => $mime];
    }

    /** Envía el archivo al cliente y termina la petición. */
    public function stream(string $bucket, string $path): void
    {
        $target = $this->absolute($bucket, $path);
        if (!is_file($target)) {
            Http::fail('Archivo no encontrado', 404, 'not_found');
        }
        $row = $this->db->one(
            'SELECT mime_type FROM stored_files WHERE bucket = :b AND path = :p LIMIT 1',
            ['b' => $bucket, 'p' => $path],
        );
        $mime = is_array($row) && is_string($row['mime_type'] ?? null) && $row['mime_type'] !== ''
            ? (string) $row['mime_type']
            : 'application/octet-stream';

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string) filesize($target));
        header('Cache-Control: private, max-age=600');
        header('Accept-Ranges: none');
        readfile($target);
        exit;
    }

    public function remove(string $bucket, string $path): bool
    {
        $target = $this->absolute($bucket, $path);
        $existed = is_file($target);
        if ($existed) {
            unlink($target);
        }
        $this->db->run(
            'DELETE FROM stored_files WHERE bucket = :b AND path = :p',
            ['b' => $bucket, 'p' => $path],
        );
        return $existed;
    }

    /** Enlace temporal firmado: /api/v1/file/{token}. */
    public function sign(string $bucket, string $path, int $seconds, string $mode = 'read'): string
    {
        $expires = time() + max(30, min(60 * 60 * 24 * 7, $seconds));
        $payload = base64_encode(json_encode(
            ['b' => $bucket, 'p' => $path, 'e' => $expires, 'm' => $mode === 'write' ? 'write' : 'read'],
            JSON_UNESCAPED_SLASHES,
        ) ?: '');
        $payload = rtrim(strtr($payload, '+/', '-_'), '=');
        $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', $payload, $this->signingKey, true)), '+/', '-_'), '=');
        return $payload . '.' . $signature;
    }

    /** Comprueba un enlace firmado y devuelve contenedor, ruta y permiso. */
    public function verify(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            Http::fail('Enlace no válido', 403, 'bad_token');
        }
        [$payload, $signature] = $parts;
        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $payload, $this->signingKey, true)), '+/', '-_'), '=');
        if (!hash_equals($expected, $signature)) {
            Http::fail('Enlace no válido', 403, 'bad_token');
        }
        $json = base64_decode(strtr($payload, '-_', '+/'), true);
        $data = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($data) || !isset($data['b'], $data['p'], $data['e'])) {
            Http::fail('Enlace no válido', 403, 'bad_token');
        }
        if ((int) $data['e'] < time()) {
            Http::fail('El enlace ha caducado', 403, 'expired');
        }
        $bucket = (string) $data['b'];
        if (!self::isBucket($bucket)) {
            Http::fail('Contenedor no válido', 404, 'unknown_bucket');
        }
        $mode = ($data['m'] ?? 'read') === 'write' ? 'write' : 'read';
        return [$bucket, (string) $data['p'], $mode];
    }
}
