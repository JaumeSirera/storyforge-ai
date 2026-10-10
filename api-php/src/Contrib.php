<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Programa de colaboradores (proyecto de código abierto).
 *
 *  - Cualquier cuenta puede solicitar ser colaboradora (con consentimiento).
 *  - Solo administración aprueba o rechaza; al aprobar se concede el rol
 *    "collaborator" en app_user_roles.
 *  - Las personas colaboradoras envían propuestas (mejoras, funciones,
 *    correcciones, contenido); ninguna se aplica sin ratificación de
 *    administración.
 */
final class Contrib
{
    public const ROLE = 'collaborator';
    private const KINDS = ['mejora', 'funcion', 'correccion', 'contenido', 'otro'];

    public function __construct(private Db $db, private ?Mail $mail, private string $adminEmail)
    {
        $this->ensureTables();
    }

    private function ensureTables(): void
    {
        $this->db->run(
            'CREATE TABLE IF NOT EXISTS app_contributor_requests (
              id CHAR(36) NOT NULL PRIMARY KEY,
              user_id CHAR(36) NOT NULL,
              email VARCHAR(255) NOT NULL,
              full_name VARCHAR(255) NULL,
              motivation TEXT NOT NULL,
              skills VARCHAR(500) NOT NULL DEFAULT \'\',
              github_user VARCHAR(100) NOT NULL DEFAULT \'\',
              consent_at TIMESTAMP(3) NOT NULL,
              status VARCHAR(20) NOT NULL DEFAULT \'pending\',
              admin_note TEXT NULL,
              decided_by CHAR(36) NULL,
              decided_at TIMESTAMP(3) NULL,
              created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              UNIQUE KEY uq_contrib_req_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $this->db->run(
            'CREATE TABLE IF NOT EXISTS app_contributions (
              id CHAR(36) NOT NULL PRIMARY KEY,
              user_id CHAR(36) NOT NULL,
              email VARCHAR(255) NOT NULL,
              kind VARCHAR(20) NOT NULL,
              title VARCHAR(200) NOT NULL,
              description TEXT NOT NULL,
              link VARCHAR(500) NOT NULL DEFAULT \'\',
              status VARCHAR(20) NOT NULL DEFAULT \'pending\',
              admin_note TEXT NULL,
              decided_by CHAR(36) NULL,
              decided_at TIMESTAMP(3) NULL,
              created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              KEY ix_contrib_user (user_id),
              KEY ix_contrib_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    private static function text(mixed $v, int $max): string
    {
        return mb_substr(trim((string) ($v ?? '')), 0, $max);
    }

    public function isCollaborator(string $userId): bool
    {
        return $this->db->one(
            'SELECT 1 AS ok FROM app_user_roles WHERE user_id = :id AND role = :r',
            ['id' => $userId, 'r' => self::ROLE]
        ) !== null;
    }

    /** @return array<string,mixed> */
    public function me(string $userId): array
    {
        $request = $this->db->one(
            'SELECT id, motivation, skills, github_user, status, admin_note, decided_at, created_at FROM app_contributor_requests WHERE user_id = :id',
            ['id' => $userId]
        );
        $proposals = $this->db->all(
            'SELECT id, kind, title, description, link, status, admin_note, decided_at, created_at FROM app_contributions WHERE user_id = :id ORDER BY created_at DESC',
            ['id' => $userId]
        );

        return ['request' => $request, 'is_collaborator' => $this->isCollaborator($userId), 'proposals' => $proposals];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function requestAccess(string $userId, array $body): array
    {
        if (($body['consent'] ?? false) !== true) {
            Http::fail('Debes aceptar las condiciones de colaboración', 400, 'missing_consent');
        }
        $motivation = self::text($body['motivation'] ?? '', 2000);
        if (mb_strlen($motivation) < 20) {
            Http::fail('Cuéntanos un poco más por qué quieres colaborar (mínimo 20 caracteres)', 400, 'short_motivation');
        }
        $github = self::text($body['github_user'] ?? '', 100);
        if ($github !== '' && !preg_match('/^[A-Za-z0-9-]{1,39}$/', $github)) {
            Http::fail('Usuario de GitHub no válido', 400, 'bad_github');
        }
        $user = $this->db->one('SELECT email, full_name FROM app_users WHERE id = :id', ['id' => $userId]);
        if ($user === null) {
            Http::fail('Cuenta no encontrada', 404, 'not_found');
        }
        $existing = $this->db->one('SELECT id, status FROM app_contributor_requests WHERE user_id = :id', ['id' => $userId]);
        if ($existing !== null && in_array($existing['status'], ['pending', 'approved'], true)) {
            Http::fail('Ya tienes una solicitud ' . ($existing['status'] === 'approved' ? 'aprobada' : 'en revisión'), 409, 'already_requested');
        }
        $params = [
            'user_id' => $userId,
            'email' => (string) $user['email'],
            'name' => $user['full_name'],
            'motivation' => $motivation,
            'skills' => self::text($body['skills'] ?? '', 500),
            'github' => $github,
            'consent' => gmdate('Y-m-d H:i:s'),
        ];
        if ($existing === null) {
            $this->db->run(
                'INSERT INTO app_contributor_requests (id, user_id, email, full_name, motivation, skills, github_user, consent_at, status)
                 VALUES (:id, :user_id, :email, :name, :motivation, :skills, :github, :consent, \'pending\')',
                ['id' => Accounts::uuid()] + $params
            );
        } else {
            $this->db->run(
                'UPDATE app_contributor_requests SET email = :email, full_name = :name, motivation = :motivation, skills = :skills,
                 github_user = :github, consent_at = :consent, status = \'pending\', admin_note = NULL, decided_by = NULL, decided_at = NULL
                 WHERE user_id = :user_id',
                $params
            );
        }
        $this->notifyAdmin(
            'Nueva solicitud de colaborador: ' . $params['email'],
            "Hay una nueva solicitud para colaborar en Xandralyze.\n\nCuenta: {$params['email']}\nGitHub: "
            . ($github !== '' ? $github : '—') . "\nHabilidades: " . ($params['skills'] !== '' ? $params['skills'] : '—')
            . "\n\nMotivo:\n{$motivation}\n\nRevísala en Administración → Colaboración."
        );

        return $this->me($userId);
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function propose(string $userId, array $body): array
    {
        if (!$this->isCollaborator($userId)) {
            Http::fail('Solo las personas colaboradoras aprobadas pueden enviar propuestas', 403, 'not_collaborator');
        }
        $kind = (string) ($body['kind'] ?? '');
        if (!in_array($kind, self::KINDS, true)) {
            Http::fail('Tipo de propuesta no válido', 400, 'bad_kind');
        }
        $title = self::text($body['title'] ?? '', 200);
        $description = self::text($body['description'] ?? '', 8000);
        if (mb_strlen($title) < 5 || mb_strlen($description) < 20) {
            Http::fail('Añade un título (mín. 5) y una descripción (mín. 20 caracteres)', 400, 'short_text');
        }
        $link = self::text($body['link'] ?? '', 500);
        if ($link !== '' && !preg_match('#^https://#i', $link)) {
            Http::fail('El enlace debe empezar por https://', 400, 'bad_link');
        }
        $user = $this->db->one('SELECT email FROM app_users WHERE id = :id', ['id' => $userId]);
        $email = (string) ($user['email'] ?? '');
        $this->db->run(
            'INSERT INTO app_contributions (id, user_id, email, kind, title, description, link, status)
             VALUES (:id, :user_id, :email, :kind, :title, :description, :link, \'pending\')',
            ['id' => Accounts::uuid(), 'user_id' => $userId, 'email' => $email, 'kind' => $kind, 'title' => $title, 'description' => $description, 'link' => $link]
        );
        $this->notifyAdmin(
            'Nueva propuesta: ' . $title,
            "{$email} ha enviado una propuesta ({$kind}).\n\n{$title}\n\n{$description}\n\n"
            . ($link !== '' ? "Enlace: {$link}\n\n" : '') . 'Ratifícala o recházala en Administración → Colaboración.'
        );

        return $this->me($userId);
    }

    /** @return array<string,mixed> */
    public function adminList(): array
    {
        return [
            'requests' => $this->db->all('SELECT * FROM app_contributor_requests ORDER BY (status = \'pending\') DESC, created_at DESC'),
            'proposals' => $this->db->all('SELECT * FROM app_contributions ORDER BY (status = \'pending\') DESC, created_at DESC'),
        ];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function adminDecide(string $adminId, array $body): array
    {
        $type = (string) ($body['type'] ?? '');
        $id = (string) ($body['id'] ?? '');
        $decision = (string) ($body['decision'] ?? '');
        $note = self::text($body['note'] ?? '', 2000);
        $allowed = $type === 'request' ? ['approved', 'rejected', 'revoked'] : ['approved', 'rejected', 'changes'];
        if (!in_array($type, ['request', 'proposal'], true) || !in_array($decision, $allowed, true)) {
            Http::fail('Decisión no válida', 400, 'bad_decision');
        }
        $table = $type === 'request' ? 'app_contributor_requests' : 'app_contributions';
        $row = $this->db->one("SELECT * FROM {$table} WHERE id = :id", ['id' => $id]);
        if ($row === null) {
            Http::fail('No encontrado', 404, 'not_found');
        }
        $this->db->run(
            "UPDATE {$table} SET status = :s, admin_note = :n, decided_by = :a, decided_at = :t WHERE id = :id",
            ['s' => $decision, 'n' => $note, 'a' => $adminId, 't' => gmdate('Y-m-d H:i:s'), 'id' => $id]
        );

        $userId = (string) $row['user_id'];
        if ($type === 'request') {
            if ($decision === 'approved') {
                $this->db->run(
                    'INSERT IGNORE INTO app_user_roles (id, user_id, role) VALUES (:id, :u, :r)',
                    ['id' => Accounts::uuid(), 'u' => $userId, 'r' => self::ROLE]
                );
            } else {
                $this->db->run('DELETE FROM app_user_roles WHERE user_id = :u AND role = :r', ['u' => $userId, 'r' => self::ROLE]);
            }
            $labels = ['approved' => 'aprobada', 'rejected' => 'rechazada', 'revoked' => 'retirada'];
            $this->notifyUser(
                (string) $row['email'],
                'Tu solicitud de colaborador ha sido ' . $labels[$decision],
                $decision === 'approved'
                    ? "¡Bienvenida/o al equipo de Xandralyze! Ya puedes enviar propuestas desde la sección Colaborar de la app.\n\n"
                    : 'Tu solicitud para colaborar ha sido ' . $labels[$decision] . ".\n\n"
            , $note);
        } else {
            $labels = ['approved' => 'ratificada', 'rejected' => 'rechazada', 'changes' => 'devuelta con cambios solicitados'];
            $this->notifyUser(
                (string) $row['email'],
                'Tu propuesta "' . $row['title'] . '" ha sido ' . $labels[$decision],
                'Tu propuesta "' . $row['title'] . '" ha sido ' . $labels[$decision] . ".\n\n",
                $note
            );
        }

        return $this->adminList();
    }

    private function notifyAdmin(string $subject, string $text): void
    {
        if (!filter_var($this->adminEmail, FILTER_VALIDATE_EMAIL)) {
            return;
        }
        $this->sendSafe($this->adminEmail, '[Xandralyze] ' . $subject, $text);
    }

    private function notifyUser(string $to, string $subject, string $text, string $note): void
    {
        if ($note !== '') {
            $text .= "Comentario de administración:\n{$note}\n\n";
        }
        $this->sendSafe($to, $subject, $text . "— Equipo de Xandralyze\nhttps://xandralyze.com");
    }

    /** Un fallo de correo nunca debe impedir guardar la decisión. */
    private function sendSafe(string $to, string $subject, string $text): void
    {
        if ($this->mail === null || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return;
        }
        try {
            $html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">'
                . nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8')) . '</div>';
            $this->mail->send(['to' => $to, 'subject' => $subject, 'text' => $text, 'html' => $html]);
        } catch (\Throwable $e) {
            error_log('[contrib] correo no enviado: ' . $e->getMessage());
        }
    }
}
