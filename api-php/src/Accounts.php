<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Cuentas propias: registro, acceso, sesiones, verificación de email y
 * recuperación de contraseña. Sustituye al sistema de cuentas externo.
 */
final class Accounts
{
    private const ACCESS_TTL = 1800;          // 30 minutos
    private const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 días
    private const RESET_TTL = 3600;           // 1 hora
    private const VERIFY_TTL = 60 * 60 * 48;  // 48 horas
    private const MAX_ATTEMPTS = 10;          // por email+IP y 15 minutos

    public function __construct(private Db $db, private Jwt $jwt)
    {
    }

    // ---- utilidades ----------------------------------------------------

    public static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);

        return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20, 12));
    }

    private static function email(mixed $value): string
    {
        $email = strtolower(trim((string) $value));
        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            Http::fail('El email no es válido', 400, 'invalid_email');
        }

        return $email;
    }

    private static function password(mixed $value): string
    {
        $password = (string) $value;
        if (strlen($password) < 8) {
            Http::fail('La contraseña debe tener al menos 8 caracteres', 400, 'weak_password');
        }

        return $password;
    }

    private static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /** @return array<string,mixed>|null */
    private function userById(string $id): ?array
    {
        return $this->db->one('SELECT * FROM app_users WHERE id = :id', ['id' => $id]);
    }

    /** @return array<string,mixed>|null */
    private function userByEmail(string $email): ?array
    {
        return $this->db->one('SELECT * FROM app_users WHERE email = :email', ['email' => $email]);
    }

    /** @return list<string> */
    private function roles(string $userId): array
    {
        $rows = $this->db->all('SELECT role FROM app_user_roles WHERE user_id = :id', ['id' => $userId]);

        return array_values(array_map(static fn (array $r): string => (string) $r['role'], $rows));
    }

    /** @param array<string,mixed> $user @return array<string,mixed> */
    private function publicUser(array $user): array
    {
        return [
            'id' => (string) $user['id'],
            'email' => (string) $user['email'],
            'full_name' => $user['full_name'] !== null ? (string) $user['full_name'] : null,
            'email_verified' => ((int) ($user['email_verified'] ?? 0)) === 1,
            'roles' => $this->roles((string) $user['id']),
            'created_at' => (string) ($user['created_at'] ?? ''),
        ];
    }

    /** @param array<string,mixed> $user @return array<string,mixed> */
    private function session(array $user): array
    {
        $userId = (string) $user['id'];
        $now = time();
        $access = $this->jwt->sign([
            'sub' => $userId,
            'email' => (string) $user['email'],
            'roles' => $this->roles($userId),
            'iat' => $now,
            'exp' => $now + self::ACCESS_TTL,
        ]);

        $refresh = bin2hex(random_bytes(32));
        $this->db->run(
            'INSERT INTO app_sessions (id, user_id, refresh_hash, expires_at, user_agent, ip) VALUES (:id, :user_id, :hash, :expires, :ua, :ip)',
            [
                'id' => self::uuid(),
                'user_id' => $userId,
                'hash' => self::hashToken($refresh),
                'expires' => gmdate('Y-m-d H:i:s', $now + self::REFRESH_TTL),
                'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250),
                'ip' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 60),
            ]
        );

        return [
            'access_token' => $access,
            'expires_in' => self::ACCESS_TTL,
            'refresh_token' => $refresh,
            'user' => $this->publicUser($user),
        ];
    }

    private function issueToken(string $userId, string $kind, int $ttl): string
    {
        $token = bin2hex(random_bytes(32));
        $this->db->run(
            'INSERT INTO app_auth_tokens (id, user_id, kind, token_hash, expires_at) VALUES (:id, :user_id, :kind, :hash, :expires)',
            [
                'id' => self::uuid(),
                'user_id' => $userId,
                'kind' => $kind,
                'hash' => self::hashToken($token),
                'expires' => gmdate('Y-m-d H:i:s', time() + $ttl),
            ]
        );

        return $token;
    }

    /** @return array<string,mixed>|null */
    private function consumeToken(string $token, string $kind): ?array
    {
        $row = $this->db->one(
            'SELECT * FROM app_auth_tokens WHERE token_hash = :hash AND kind = :kind AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3)',
            ['hash' => self::hashToken($token), 'kind' => $kind]
        );
        if ($row === null) {
            return null;
        }
        $this->db->run('UPDATE app_auth_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = :id', ['id' => (string) $row['id']]);

        return $row;
    }

    private function throttle(string $email): void
    {
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $row = $this->db->one(
            'SELECT COUNT(*) AS total FROM app_login_attempts WHERE email = :email AND ip = :ip AND created_at > (UTC_TIMESTAMP(3) - INTERVAL 15 MINUTE)',
            ['email' => $email, 'ip' => $ip]
        );
        if ((int) ($row['total'] ?? 0) >= self::MAX_ATTEMPTS) {
            Http::fail('Demasiados intentos. Prueba de nuevo en unos minutos.', 429, 'too_many_attempts');
        }
    }

    private function logAttempt(string $email, bool $ok): void
    {
        $this->db->run(
            'INSERT INTO app_login_attempts (id, email, ip, success) VALUES (:id, :email, :ip, :ok)',
            [
                'id' => self::uuid(),
                'email' => $email,
                'ip' => substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 60),
                'ok' => $ok ? 1 : 0,
            ]
        );
    }

    // ---- operaciones ---------------------------------------------------

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function register(array $body): array
    {
        $email = self::email($body['email'] ?? '');
        $password = self::password($body['password'] ?? '');
        $fullName = trim((string) ($body['full_name'] ?? ''));

        if ($this->userByEmail($email) !== null) {
            Http::fail('Ya existe una cuenta con ese email', 409, 'email_taken');
        }

        $id = isset($body['id']) && is_string($body['id']) && $body['id'] !== '' ? (string) $body['id'] : self::uuid();
        $this->db->run(
            'INSERT INTO app_users (id, email, password_hash, full_name, email_verified) VALUES (:id, :email, :hash, :name, 0)',
            [
                'id' => $id,
                'email' => $email,
                'hash' => password_hash($password, PASSWORD_BCRYPT),
                'name' => $fullName !== '' ? $fullName : null,
            ]
        );

        $user = $this->userById($id) ?? Http::fail('No se ha podido crear la cuenta', 500, 'create_failed');
        /** @var array<string,mixed> $user */
        $session = $this->session($user);
        $session['verification_token'] = $this->issueToken($id, 'verify', self::VERIFY_TTL);

        return $session;
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function login(array $body): array
    {
        $email = self::email($body['email'] ?? '');
        $this->throttle($email);

        $user = $this->userByEmail($email);
        $hash = is_array($user) ? (string) ($user['password_hash'] ?? '') : '';
        if ($user === null || $hash === '' || !password_verify((string) ($body['password'] ?? ''), $hash)) {
            $this->logAttempt($email, false);
            Http::fail('Email o contraseña incorrectos', 401, 'invalid_credentials');
        }
        if ((int) ($user['disabled'] ?? 0) === 1) {
            Http::fail('Esta cuenta está desactivada', 403, 'account_disabled');
        }

        $this->logAttempt($email, true);
        $this->db->run('UPDATE app_users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = :id', ['id' => (string) $user['id']]);

        return $this->session($user);
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function refresh(array $body): array
    {
        $token = (string) ($body['refresh_token'] ?? '');
        if ($token === '') {
            Http::fail('Falta el token de sesión', 400, 'missing_refresh_token');
        }
        $row = $this->db->one(
            'SELECT * FROM app_sessions WHERE refresh_hash = :hash AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(3)',
            ['hash' => self::hashToken($token)]
        );
        if ($row === null) {
            Http::fail('Sesión caducada. Vuelve a entrar.', 401, 'invalid_refresh_token');
        }
        $user = $this->userById((string) $row['user_id']);
        if ($user === null) {
            Http::fail('Sesión no válida', 401, 'invalid_refresh_token');
        }
        // Rotación: la sesión anterior se anula al entregar una nueva.
        $this->db->run('UPDATE app_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE id = :id', ['id' => (string) $row['id']]);

        return $this->session($user);
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function logout(array $body): array
    {
        $token = (string) ($body['refresh_token'] ?? '');
        if ($token !== '') {
            $this->db->run(
                'UPDATE app_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE refresh_hash = :hash AND revoked_at IS NULL',
                ['hash' => self::hashToken($token)]
            );
        }

        return ['ok' => true];
    }

    /** @return array<string,mixed> */
    public function me(string $userId): array
    {
        $user = $this->userById($userId);
        if ($user === null) {
            Http::fail('Cuenta no encontrada', 404, 'not_found');
        }

        return $this->publicUser($user);
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function forgot(array $body): array
    {
        $email = self::email($body['email'] ?? '');
        $user = $this->userByEmail($email);
        if ($user === null) {
            // No se revela si el email existe.
            return ['ok' => true, 'token' => null, 'email' => $email, 'full_name' => null];
        }

        return [
            'ok' => true,
            'token' => $this->issueToken((string) $user['id'], 'reset', self::RESET_TTL),
            'email' => $email,
            'full_name' => $user['full_name'] !== null ? (string) $user['full_name'] : null,
        ];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function reset(array $body): array
    {
        $token = (string) ($body['token'] ?? '');
        $password = self::password($body['password'] ?? '');
        $row = $token !== '' ? $this->consumeToken($token, 'reset') : null;
        if ($row === null) {
            Http::fail('El enlace no es válido o ha caducado', 400, 'invalid_token');
        }
        $userId = (string) $row['user_id'];
        $this->db->run(
            'UPDATE app_users SET password_hash = :hash, email_verified = 1 WHERE id = :id',
            ['hash' => password_hash($password, PASSWORD_BCRYPT), 'id' => $userId]
        );
        // Al cambiar la contraseña se cierran todas las sesiones abiertas.
        $this->db->run('UPDATE app_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = :id AND revoked_at IS NULL', ['id' => $userId]);
        $user = $this->userById($userId);
        if ($user === null) {
            Http::fail('Cuenta no encontrada', 404, 'not_found');
        }

        return $this->session($user);
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function verify(array $body): array
    {
        $token = (string) ($body['token'] ?? '');
        $row = $token !== '' ? $this->consumeToken($token, 'verify') : null;
        if ($row === null) {
            Http::fail('El enlace no es válido o ha caducado', 400, 'invalid_token');
        }
        $this->db->run('UPDATE app_users SET email_verified = 1 WHERE id = :id', ['id' => (string) $row['user_id']]);

        return ['ok' => true];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function changePassword(string $userId, array $body): array
    {
        $user = $this->userById($userId);
        if ($user === null) {
            Http::fail('Cuenta no encontrada', 404, 'not_found');
        }
        $current = (string) ($body['current_password'] ?? '');
        if (!password_verify($current, (string) ($user['password_hash'] ?? ''))) {
            Http::fail('La contraseña actual no es correcta', 400, 'invalid_current_password');
        }
        $password = self::password($body['new_password'] ?? '');
        $this->db->run(
            'UPDATE app_users SET password_hash = :hash WHERE id = :id',
            ['hash' => password_hash($password, PASSWORD_BCRYPT), 'id' => $userId]
        );

        return ['ok' => true];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function updateProfile(string $userId, array $body): array
    {
        if (array_key_exists('full_name', $body)) {
            $name = trim((string) $body['full_name']);
            $this->db->run(
                'UPDATE app_users SET full_name = :name WHERE id = :id',
                ['name' => $name !== '' ? $name : null, 'id' => $userId]
            );
        }

        return $this->me($userId);
    }

    /**
     * Importación de cuentas existentes (solo modo servicio). Las contraseñas
     * no viajan: cada cuenta queda sin contraseña y recibe un enlace para
     * establecerla.
     *
     * @param array<string,mixed> $body
     * @return array<string,mixed>
     */
    public function import(array $body): array
    {
        $users = is_array($body['users'] ?? null) ? $body['users'] : [];
        $imported = 0;
        $skipped = 0;
        $invites = [];

        foreach ($users as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $email = strtolower(trim((string) ($entry['email'] ?? '')));
            $id = (string) ($entry['id'] ?? '');
            if ($email === '' || $id === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                $skipped++;
                continue;
            }
            $existing = $this->db->one('SELECT id FROM app_users WHERE id = :id OR email = :email', ['id' => $id, 'email' => $email]);
            if ($existing !== null) {
                $skipped++;
                continue;
            }
            $name = trim((string) ($entry['full_name'] ?? ''));
            $this->db->run(
                'INSERT INTO app_users (id, email, password_hash, full_name, email_verified) VALUES (:id, :email, NULL, :name, :verified)',
                [
                    'id' => $id,
                    'email' => $email,
                    'name' => $name !== '' ? $name : null,
                    'verified' => !empty($entry['email_verified']) ? 1 : 0,
                ]
            );
            foreach ((array) ($entry['roles'] ?? []) as $role) {
                $role = trim((string) $role);
                if ($role === '') {
                    continue;
                }
                $this->db->run(
                    'INSERT IGNORE INTO app_user_roles (id, user_id, role) VALUES (:id, :user_id, :role)',
                    ['id' => self::uuid(), 'user_id' => $id, 'role' => $role]
                );
            }
            $imported++;
            $invites[] = [
                'id' => $id,
                'email' => $email,
                'full_name' => $name !== '' ? $name : null,
                'token' => $this->issueToken($id, 'reset', 60 * 60 * 24 * 14),
            ];
        }

        return ['imported' => $imported, 'skipped' => $skipped, 'invites' => $invites];
    }

    // ---- administración -------------------------------------------------

    /** ¿La cuenta tiene ese rol? */
    public function hasRole(string $userId, string $role): bool
    {
        $row = $this->db->one(
            'SELECT 1 AS ok FROM app_user_roles WHERE user_id = :id AND role = :role',
            ['id' => $userId, 'role' => $role]
        );

        return $row !== null;
    }

    /** Todas las cuentas con sus roles (solo administración). @return array<string,mixed> */
    public function adminUsers(): array
    {
        $rows = $this->db->all(
            'SELECT id, email, full_name, email_verified, disabled, last_login_at, created_at FROM app_users ORDER BY created_at ASC'
        );
        $roleRows = $this->db->all('SELECT user_id, role FROM app_user_roles');
        $byUser = [];
        foreach ($roleRows as $r) {
            $byUser[(string) $r['user_id']][] = (string) $r['role'];
        }

        $users = [];
        foreach ($rows as $row) {
            $id = (string) $row['id'];
            $users[] = [
                'id' => $id,
                'email' => (string) $row['email'],
                'full_name' => $row['full_name'] !== null ? (string) $row['full_name'] : null,
                'email_verified' => ((int) ($row['email_verified'] ?? 0)) === 1,
                'disabled' => ((int) ($row['disabled'] ?? 0)) === 1,
                'last_login_at' => $row['last_login_at'] !== null ? (string) $row['last_login_at'] : null,
                'created_at' => (string) ($row['created_at'] ?? ''),
                'roles' => $byUser[$id] ?? [],
            ];
        }

        return ['users' => $users];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function adminCreate(array $body): array
    {
        $email = self::email($body['email'] ?? '');
        $password = self::password($body['password'] ?? '');
        if ($this->userByEmail($email) !== null) {
            Http::fail('Ya existe una cuenta con ese email', 409, 'email_taken');
        }
        $id = self::uuid();
        $name = trim((string) ($body['full_name'] ?? ''));
        $this->db->run(
            'INSERT INTO app_users (id, email, password_hash, full_name, email_verified) VALUES (:id, :email, :hash, :name, 1)',
            [
                'id' => $id,
                'email' => $email,
                'hash' => password_hash($password, PASSWORD_BCRYPT),
                'name' => $name !== '' ? $name : null,
            ]
        );
        if (!empty($body['is_admin'])) {
            $this->grantRole($id, 'admin');
        }

        return ['ok' => true, 'user_id' => $id];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function adminUpdate(array $body): array
    {
        $userId = (string) ($body['user_id'] ?? '');
        if ($this->userById($userId) === null) {
            Http::fail('Cuenta no encontrada', 404, 'not_found');
        }
        if (array_key_exists('full_name', $body)) {
            $name = trim((string) $body['full_name']);
            $this->db->run(
                'UPDATE app_users SET full_name = :name WHERE id = :id',
                ['name' => $name !== '' ? $name : null, 'id' => $userId]
            );
        }
        if (array_key_exists('disabled', $body)) {
            $disabled = !empty($body['disabled']) ? 1 : 0;
            $this->db->run('UPDATE app_users SET disabled = :d WHERE id = :id', ['d' => $disabled, 'id' => $userId]);
            if ($disabled === 1) {
                $this->db->run('UPDATE app_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = :id AND revoked_at IS NULL', ['id' => $userId]);
            }
        }
        if (array_key_exists('is_admin', $body)) {
            if (!empty($body['is_admin'])) {
                $this->grantRole($userId, 'admin');
            } else {
                $this->db->run('DELETE FROM app_user_roles WHERE user_id = :id AND role = :role', ['id' => $userId, 'role' => 'admin']);
            }
        }

        return ['ok' => true];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function adminSetPassword(array $body): array
    {
        $userId = (string) ($body['user_id'] ?? '');
        if ($this->userById($userId) === null) {
            Http::fail('Cuenta no encontrada', 404, 'not_found');
        }
        $password = self::password($body['password'] ?? '');
        $this->db->run(
            'UPDATE app_users SET password_hash = :hash, email_verified = 1 WHERE id = :id',
            ['hash' => password_hash($password, PASSWORD_BCRYPT), 'id' => $userId]
        );
        $this->db->run('UPDATE app_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = :id AND revoked_at IS NULL', ['id' => $userId]);

        return ['ok' => true];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function adminDelete(array $body): array
    {
        $userId = (string) ($body['user_id'] ?? '');
        if ($userId === '') {
            Http::fail('Falta la cuenta', 400, 'missing_user');
        }
        $this->db->run('DELETE FROM app_user_roles WHERE user_id = :id', ['id' => $userId]);
        $this->db->run('DELETE FROM app_sessions WHERE user_id = :id', ['id' => $userId]);
        $this->db->run('DELETE FROM app_auth_tokens WHERE user_id = :id', ['id' => $userId]);
        $this->db->run('DELETE FROM app_users WHERE id = :id', ['id' => $userId]);

        return ['ok' => true];
    }

    /**
     * Añade o quita un rol por email o por identificador (administración o
     * modo servicio). @param array<string,mixed> $body @return array<string,mixed>
     */
    public function setRole(array $body): array
    {
        $role = trim((string) ($body['role'] ?? 'admin'));
        if ($role === '') {
            Http::fail('Falta el rol', 400, 'missing_role');
        }
        $userId = (string) ($body['user_id'] ?? '');
        if ($userId === '' && isset($body['email'])) {
            $user = $this->userByEmail(self::email($body['email']));
            if ($user === null) {
                Http::fail('Cuenta no encontrada', 404, 'not_found');
            }
            $userId = (string) $user['id'];
        }
        if ($userId === '') {
            Http::fail('Falta la cuenta', 400, 'missing_user');
        }
        $remove = ($body['action'] ?? 'add') === 'remove';
        if ($remove) {
            $this->db->run('DELETE FROM app_user_roles WHERE user_id = :id AND role = :role', ['id' => $userId, 'role' => $role]);
        } else {
            $this->grantRole($userId, $role);
        }

        return ['ok' => true, 'user_id' => $userId, 'roles' => $this->roles($userId)];
    }

    private function grantRole(string $userId, string $role): void
    {
        $this->db->run(
            'INSERT IGNORE INTO app_user_roles (id, user_id, role) VALUES (:id, :user_id, :role)',
            ['id' => self::uuid(), 'user_id' => $userId, 'role' => $role]
        );
    }
}
