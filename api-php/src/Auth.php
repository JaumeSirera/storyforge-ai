<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Identidad: el usuario sigue registrándose y accediendo con Lovable Cloud.
 * Esta clase solo comprueba a quién pertenece el token que llega en la petición.
 */
final class Auth
{
    private const CACHE_TTL = 60;

    public function __construct(
        private string $identityUrl,
        private string $identityKey,
        private string $appToken,
    ) {
    }

    /** Comprueba la clave compartida entre la app y esta API. */
    public function assertAppToken(): void
    {
        $sent = $_SERVER['HTTP_X_APP_TOKEN'] ?? '';
        if (!is_string($sent) || $sent === '' || !hash_equals($this->appToken, $sent)) {
            Http::fail('Aplicación no autorizada', 401, 'app_token_invalid');
        }
    }

    /** Devuelve el identificador del usuario dueño de la petición. */
    public function userId(): string
    {
        $token = Http::bearer();
        if ($token === null) {
            Http::fail('Falta el token del usuario', 401, 'missing_token');
        }

        $cached = $this->readCache($token);
        if ($cached !== null) {
            return $cached;
        }

        $ch = curl_init(rtrim($this->identityUrl, '/') . '/auth/v1/user');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'apikey: ' . $this->identityKey,
                'Accept: application/json',
            ],
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($status !== 200 || !is_string($response)) {
            Http::fail('Sesión no válida o caducada', 401, 'invalid_token');
        }

        $data = json_decode($response, true);
        $id = is_array($data) && isset($data['id']) ? (string) $data['id'] : '';
        if ($id === '') {
            Http::fail('No se ha podido identificar al usuario', 401, 'invalid_token');
        }

        $this->writeCache($token, $id);
        return $id;
    }

    private function cachePath(string $token): string
    {
        return sys_get_temp_dir() . '/xz-auth-' . hash('sha256', $token) . '.txt';
    }

    private function readCache(string $token): ?string
    {
        $path = $this->cachePath($token);
        if (!is_readable($path) || (time() - (int) filemtime($path)) > self::CACHE_TTL) {
            return null;
        }
        $value = trim((string) file_get_contents($path));
        return $value === '' ? null : $value;
    }

    private function writeCache(string $token, string $userId): void
    {
        @file_put_contents($this->cachePath($token), $userId, LOCK_EX);
    }
}
