<?php

declare(strict_types=1);

namespace Xandralyze;

/** Firma y verificación de tokens de acceso (HS256). */
final class Jwt
{
    public function __construct(private string $secret)
    {
    }

    /** @param array<string,mixed> $claims */
    public function sign(array $claims): string
    {
        $header = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES) ?: '{}');
        $payload = self::b64(json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}');
        $signature = self::b64(hash_hmac('sha256', $header . '.' . $payload, $this->secret, true));

        return $header . '.' . $payload . '.' . $signature;
    }

    /** @return array<string,mixed>|null Devuelve las claims si el token es válido y no ha caducado. */
    public function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        [$header, $payload, $signature] = $parts;

        $expected = self::b64(hash_hmac('sha256', $header . '.' . $payload, $this->secret, true));
        if (!hash_equals($expected, $signature)) {
            return null;
        }

        $decoded = json_decode(self::unb64($payload), true);
        if (!is_array($decoded)) {
            return null;
        }
        $exp = isset($decoded['exp']) ? (int) $decoded['exp'] : 0;
        if ($exp !== 0 && $exp < time()) {
            return null;
        }

        /** @var array<string,mixed> $decoded */
        return $decoded;
    }

    private static function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private static function unb64(string $value): string
    {
        $padded = strtr($value, '-_', '+/');
        $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);

        return base64_decode($padded, true) ?: '';
    }
}
