<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Estudio de redes sociales (antes "Story Weaver Social"), solo administración.
 *
 * Series de capítulos generadas por IA que se publican con Upload-Post.
 * Las tablas se crean solas la primera vez.
 */
final class Social
{
    public const NETWORKS = ['instagram', 'x', 'linkedin', 'facebook', 'tiktok', 'threads', 'youtube'];
    private const STATUSES = ['pendiente', 'programado', 'publicado', 'enviando', 'error'];

    public function __construct(private Db $db)
    {
        $this->ensureTables();
    }

    private function ensureTables(): void
    {
        $this->db->run(
            'CREATE TABLE IF NOT EXISTS app_social_settings (
              user_id CHAR(36) NOT NULL PRIMARY KEY,
              ayrshare_key TEXT NULL,
              updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $this->db->run(
            'CREATE TABLE IF NOT EXISTS app_social_stories (
              id CHAR(36) NOT NULL PRIMARY KEY,
              owner_id CHAR(36) NOT NULL,
              title VARCHAR(300) NOT NULL,
              source_text MEDIUMTEXT NULL,
              networks TEXT NOT NULL,
              every_days INT NOT NULL DEFAULT 7,
              created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              KEY ix_social_story_owner (owner_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $this->db->run(
            'CREATE TABLE IF NOT EXISTS app_social_chapters (
              id CHAR(36) NOT NULL PRIMARY KEY,
              story_id CHAR(36) NOT NULL,
              owner_id CHAR(36) NOT NULL,
              position INT NOT NULL DEFAULT 0,
              title VARCHAR(300) NOT NULL,
              body TEXT NOT NULL,
              links TEXT NOT NULL,
              media TEXT NOT NULL,
              scheduled_at DATETIME NULL,
              status VARCHAR(20) NOT NULL DEFAULT \'pendiente\',
              result TEXT NULL,
              published_at DATETIME NULL,
              created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
              KEY ix_social_ch_story (story_id),
              KEY ix_social_ch_due (status, scheduled_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    private static function text(mixed $v, int $max): string
    {
        return mb_substr(trim((string) ($v ?? '')), 0, $max);
    }

    /** @return list<string> */
    private static function networks(mixed $v): array
    {
        $list = is_array($v) ? $v : [];
        return array_values(array_unique(array_filter(array_map('strval', $list), fn ($n) => in_array($n, self::NETWORKS, true))));
    }

    private static function json(mixed $v): string
    {
        return json_encode(is_array($v) ? array_values($v) : [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]';
    }

    private static function date(mixed $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        $t = strtotime((string) $v);
        if ($t === false) {
            Http::fail('Fecha no válida', 400, 'bad_date');
        }
        return gmdate('Y-m-d H:i:s', $t);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function story(array $row): array
    {
        $row['networks'] = json_decode((string) $row['networks'], true) ?: [];
        $row['every_days'] = (int) $row['every_days'];
        return $row;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function chapter(array $row): array
    {
        $row['links'] = json_decode((string) $row['links'], true) ?: [];
        $row['media'] = json_decode((string) $row['media'], true) ?: [];
        $row['position'] = (int) $row['position'];
        foreach (['scheduled_at', 'published_at'] as $k) {
            if (!empty($row[$k])) {
                $row[$k] = gmdate('c', (int) strtotime($row[$k] . ' UTC'));
            }
        }
        return $row;
    }

    // ---- Ajustes (Upload-Post) --------------------------------------------

    private function ensureUploadPostColumns(): void
    {
        foreach (['uploadpost_key' => 'TEXT NULL', 'uploadpost_user' => 'VARCHAR(200) NULL', 'facebook_page_id' => 'VARCHAR(100) NULL'] as $col => $def) {
            $exists = $this->db->one(
                'SELECT 1 AS x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'app_social_settings\' AND COLUMN_NAME = :c',
                ['c' => $col]
            );
            if ($exists === null) $this->db->run("ALTER TABLE app_social_settings ADD COLUMN $col $def");
        }
    }

    /** @return array<string,mixed>|null */
    private function settingsRow(string $userId): ?array
    {
        $this->ensureUploadPostColumns();
        return $this->db->one('SELECT uploadpost_key, uploadpost_user, facebook_page_id FROM app_social_settings WHERE user_id = :u', ['u' => $userId]);
    }

    /** @return array<string,mixed> */
    public function settings(string $userId): array
    {
        $row = $this->settingsRow($userId);
        return [
            'has_key' => $row !== null && trim((string) $row['uploadpost_key']) !== '',
            'profile' => (string) ($row['uploadpost_user'] ?? ''),
            'facebook_page_id' => (string) ($row['facebook_page_id'] ?? ''),
        ];
    }

    /** Solo la llama el servidor web (nunca el navegador). @return array<string,mixed> */
    public function publishCredentials(string $userId): array
    {
        $row = $this->settingsRow($userId);
        $key = trim((string) ($row['uploadpost_key'] ?? ''));
        return [
            'key' => $key === '' ? null : $key,
            'profile' => (string) ($row['uploadpost_user'] ?? ''),
            'facebook_page_id' => (string) ($row['facebook_page_id'] ?? ''),
        ];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function saveSettings(string $userId, array $body): array
    {
        $this->ensureUploadPostColumns();
        $this->db->run('INSERT IGNORE INTO app_social_settings (user_id) VALUES (:u)', ['u' => $userId]);
        if (array_key_exists('key', $body)) {
            $key = self::text($body['key'] ?? '', 500);
            $this->db->run('UPDATE app_social_settings SET uploadpost_key = :k WHERE user_id = :u', ['u' => $userId, 'k' => $key === '' ? null : $key]);
        }
        if (array_key_exists('profile', $body)) {
            $this->db->run('UPDATE app_social_settings SET uploadpost_user = :p WHERE user_id = :u', ['u' => $userId, 'p' => self::text($body['profile'] ?? '', 200)]);
        }
        if (array_key_exists('facebook_page_id', $body)) {
            $this->db->run('UPDATE app_social_settings SET facebook_page_id = :f WHERE user_id = :u', ['u' => $userId, 'f' => self::text($body['facebook_page_id'] ?? '', 100)]);
        }
        return $this->settings($userId);
    }

    // ---- Series ------------------------------------------------------------

    /** @return list<array<string,mixed>> */
    public function listStories(string $userId): array
    {
        $rows = $this->db->all(
            'SELECT s.id, s.title, s.networks, s.every_days, s.created_at, s.updated_at,
                    COUNT(c.id) AS chapters,
                    SUM(c.status = \'publicado\') AS published,
                    SUM(c.status = \'programado\') AS scheduled,
                    SUM(c.status = \'error\') AS errors
             FROM app_social_stories s
             LEFT JOIN app_social_chapters c ON c.story_id = s.id
             WHERE s.owner_id = :u
             GROUP BY s.id ORDER BY s.updated_at DESC',
            ['u' => $userId]
        );
        return array_map(function ($r) {
            $r = self::story($r);
            foreach (['chapters', 'published', 'scheduled', 'errors'] as $k) {
                $r[$k] = (int) ($r[$k] ?? 0);
            }
            return $r;
        }, $rows);
    }

    /** @return array<string,mixed> */
    public function getStory(string $userId, string $id): array
    {
        $row = $this->db->one('SELECT * FROM app_social_stories WHERE id = :id AND owner_id = :u', ['id' => $id, 'u' => $userId]);
        if ($row === null) {
            Http::fail('Serie no encontrada', 404, 'not_found');
        }
        $chapters = $this->db->all(
            'SELECT * FROM app_social_chapters WHERE story_id = :id ORDER BY position ASC, created_at ASC',
            ['id' => $id]
        );
        return ['story' => self::story($row), 'chapters' => array_map([self::class, 'chapter'], $chapters)];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function createStory(string $userId, array $body): array
    {
        $title = self::text($body['title'] ?? '', 300);
        if ($title === '') {
            Http::fail('Falta el título', 400, 'missing_title');
        }
        $chapters = is_array($body['chapters'] ?? null) ? $body['chapters'] : [];
        if (count($chapters) === 0 || count($chapters) > 60) {
            Http::fail('La serie necesita entre 1 y 60 capítulos', 400, 'bad_chapters');
        }
        $id = Accounts::uuid();
        $pdo = $this->db->pdo();
        $pdo->beginTransaction();
        try {
            $this->db->run(
                'INSERT INTO app_social_stories (id, owner_id, title, source_text, networks, every_days)
                 VALUES (:id, :u, :t, :s, :n, :e)',
                [
                    'id' => $id, 'u' => $userId, 't' => $title,
                    's' => self::text($body['source_text'] ?? '', 200000),
                    'n' => self::json(self::networks($body['networks'] ?? [])),
                    'e' => max(1, min(90, (int) ($body['every_days'] ?? 7))),
                ]
            );
            foreach (array_values($chapters) as $i => $c) {
                $this->insertChapter($userId, $id, $i, is_array($c) ? $c : []);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return $this->getStory($userId, $id);
    }

    /** @param array<string,mixed> $c */
    private function insertChapter(string $userId, string $storyId, int $position, array $c): string
    {
        $chId = Accounts::uuid();
        $scheduled = self::date($c['scheduled_at'] ?? null);
        $this->db->run(
            'INSERT INTO app_social_chapters (id, story_id, owner_id, position, title, body, links, media, scheduled_at, status)
             VALUES (:id, :s, :u, :p, :t, :b, :l, :m, :d, :st)',
            [
                'id' => $chId, 's' => $storyId, 'u' => $userId, 'p' => $position,
                't' => self::text($c['title'] ?? ('Capítulo ' . ($position + 1)), 300),
                'b' => self::text($c['body'] ?? '', 20000),
                'l' => self::json($c['links'] ?? []),
                'm' => self::json($c['media'] ?? []),
                'd' => $scheduled,
                'st' => $scheduled !== null ? 'programado' : 'pendiente',
            ]
        );
        return $chId;
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function updateStory(string $userId, string $id, array $body): array
    {
        $this->getStory($userId, $id);
        if (array_key_exists('title', $body)) {
            $t = self::text($body['title'], 300);
            if ($t !== '') {
                $this->db->run('UPDATE app_social_stories SET title = :t WHERE id = :id', ['t' => $t, 'id' => $id]);
            }
        }
        if (array_key_exists('networks', $body)) {
            $this->db->run('UPDATE app_social_stories SET networks = :n WHERE id = :id', ['n' => self::json(self::networks($body['networks'])), 'id' => $id]);
        }
        if (array_key_exists('every_days', $body)) {
            $this->db->run('UPDATE app_social_stories SET every_days = :e WHERE id = :id', ['e' => max(1, min(90, (int) $body['every_days'])), 'id' => $id]);
        }
        return $this->getStory($userId, $id);
    }

    /** @return array<string,mixed> */
    public function deleteStory(string $userId, string $id): array
    {
        $this->getStory($userId, $id);
        $this->db->run('DELETE FROM app_social_chapters WHERE story_id = :id', ['id' => $id]);
        $this->db->run('DELETE FROM app_social_stories WHERE id = :id', ['id' => $id]);
        return ['id' => $id, 'deleted' => true];
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function addChapter(string $userId, string $storyId, array $body): array
    {
        $this->getStory($userId, $storyId);
        $max = $this->db->one('SELECT COALESCE(MAX(position), -1) AS m FROM app_social_chapters WHERE story_id = :id', ['id' => $storyId]);
        $this->insertChapter($userId, $storyId, ((int) ($max['m'] ?? -1)) + 1, $body);
        return $this->getStory($userId, $storyId);
    }

    /** @return array<string,mixed> */
    private function ownChapter(string $userId, string $id): array
    {
        $row = $this->db->one('SELECT * FROM app_social_chapters WHERE id = :id AND owner_id = :u', ['id' => $id, 'u' => $userId]);
        if ($row === null) {
            Http::fail('Capítulo no encontrado', 404, 'not_found');
        }
        return $row;
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function updateChapter(string $userId, string $id, array $body): array
    {
        $row = $this->ownChapter($userId, $id);
        $sets = [];
        $p = ['id' => $id];
        if (array_key_exists('title', $body)) { $sets[] = 'title = :t'; $p['t'] = self::text($body['title'], 300); }
        if (array_key_exists('body', $body)) { $sets[] = 'body = :b'; $p['b'] = self::text($body['body'], 20000); }
        if (array_key_exists('links', $body)) { $sets[] = 'links = :l'; $p['l'] = self::json($body['links']); }
        if (array_key_exists('media', $body)) { $sets[] = 'media = :m'; $p['m'] = self::json($body['media']); }
        if (array_key_exists('scheduled_at', $body)) {
            $d = self::date($body['scheduled_at']);
            $sets[] = 'scheduled_at = :d';
            $p['d'] = $d;
            if (!array_key_exists('status', $body) && !in_array($row['status'], ['publicado', 'enviando'], true)) {
                $sets[] = 'status = :st';
                $p['st'] = $d !== null ? 'programado' : 'pendiente';
            }
        }
        if (array_key_exists('status', $body) && in_array($body['status'], self::STATUSES, true)) {
            $sets[] = 'status = :st';
            $p['st'] = $body['status'];
        }
        if (array_key_exists('result', $body)) { $sets[] = 'result = :r'; $p['r'] = self::text($body['result'], 5000); }
        if (($body['status'] ?? '') === 'publicado') { $sets[] = 'published_at = UTC_TIMESTAMP()'; }
        elseif (array_key_exists('status', $body)) { $sets[] = 'published_at = NULL'; }
        if ($sets) {
            $this->db->run('UPDATE app_social_chapters SET ' . implode(', ', $sets) . ' WHERE id = :id', $p);
        }
        return $this->getStory($userId, (string) $row['story_id']);
    }

    /** @return array<string,mixed> */
    public function deleteChapter(string $userId, string $id): array
    {
        $row = $this->ownChapter($userId, $id);
        $this->db->run('DELETE FROM app_social_chapters WHERE id = :id', ['id' => $id]);
        return $this->getStory($userId, (string) $row['story_id']);
    }

    /** Calendario: capítulos con fecha. @return list<array<string,mixed>> */
    public function queue(string $userId): array
    {
        $rows = $this->db->all(
            'SELECT c.id, c.story_id, c.title, c.status, c.scheduled_at, c.published_at, c.result, s.title AS story_title, s.networks
             FROM app_social_chapters c JOIN app_social_stories s ON s.id = c.story_id
             WHERE c.owner_id = :u AND c.scheduled_at IS NOT NULL
             ORDER BY c.scheduled_at ASC LIMIT 500',
            ['u' => $userId]
        );
        return array_map(function ($r) {
            $r['networks'] = json_decode((string) $r['networks'], true) ?: [];
            foreach (['scheduled_at', 'published_at'] as $k) {
                if (!empty($r[$k])) {
                    $r[$k] = gmdate('c', (int) strtotime($r[$k] . ' UTC'));
                }
            }
            return $r;
        }, $rows);
    }

    /** Tarea programada (modo servicio): capítulos que ya tocan. @return list<array<string,mixed>> */
    public function due(int $limit = 20): array
    {
        $this->ensureUploadPostColumns();
        $rows = $this->db->all(
            'SELECT c.*, s.networks AS story_networks, st.uploadpost_key, st.uploadpost_user, st.facebook_page_id
             FROM app_social_chapters c
             JOIN app_social_stories s ON s.id = c.story_id
             LEFT JOIN app_social_settings st ON st.user_id = c.owner_id
             WHERE c.status = \'enviando\' OR (c.status = \'programado\' AND c.scheduled_at <= UTC_TIMESTAMP())
             ORDER BY c.updated_at ASC LIMIT ' . max(1, min(50, $limit))
        );
        return array_map(function ($r) {
            $r = self::chapter($r);
            $r['networks'] = json_decode((string) $r['story_networks'], true) ?: [];
            unset($r['story_networks']);
            return $r;
        }, $rows);
    }

    /** Modo servicio: guarda el resultado de una publicación. @param array<string,mixed> $body @return array<string,mixed> */
    public function serviceResult(string $id, array $body): array
    {
        $status = in_array($body['status'] ?? '', ['publicado', 'enviando', 'error'], true) ? $body['status'] : 'error';
        $this->db->run(
            'UPDATE app_social_chapters SET status = :s, result = :r'
            . ($status === 'publicado' ? ', published_at = UTC_TIMESTAMP()' : ', published_at = NULL')
            . ' WHERE id = :id',
            ['s' => $status, 'r' => self::text($body['result'] ?? '', 5000), 'id' => $id]
        );
        return ['id' => $id, 'status' => $status];
    }
}
