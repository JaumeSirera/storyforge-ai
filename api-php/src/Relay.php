<?php

declare(strict_types=1);

namespace Xandralyze;

use PDO;

/**
 * Conexión en directo de las grabaciones multicámara (sustituye al canal en
 * tiempo real de Lovable Cloud). Funciona por sondeo: cada dispositivo envía
 * mensajes a una "sala" y pregunta cada poco por los nuevos, además de avisar
 * de que sigue conectado (presencia). Tablas creadas automáticamente.
 */
final class Relay
{
    private const PRESENCE_TTL = 12; // segundos sin señal = desconectado

    public function __construct(private PDO $db)
    {
        $this->db->exec("CREATE TABLE IF NOT EXISTS app_relay_messages (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            room VARCHAR(190) NOT NULL,
            sender VARCHAR(190) NOT NULL,
            event VARCHAR(60) NOT NULL,
            payload MEDIUMTEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_room_id (room, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $this->db->exec("CREATE TABLE IF NOT EXISTS app_relay_presence (
            room VARCHAR(190) NOT NULL,
            member VARCHAR(190) NOT NULL,
            info TEXT NOT NULL,
            last_seen INT UNSIGNED NOT NULL,
            PRIMARY KEY (room, member)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    private static function room(string $room): string
    {
        if (!preg_match('/^[A-Za-z0-9_\-]{8,190}$/', $room)) {
            Http::fail('Sala no válida', 400, 'bad_room');
        }
        return $room;
    }

    public function handle(string $room, string $action, string $method): void
    {
        $room = self::room($room);
        $body = $method === 'POST' ? Http::body() : [];
        $member = substr((string) ($body['member'] ?? $_GET['member'] ?? ''), 0, 190);

        if ($action === 'send' && $method === 'POST') {
            $event = substr((string) ($body['event'] ?? ''), 0, 60);
            if ($event === '' || $member === '') Http::fail('Faltan datos', 400, 'bad_input');
            $payload = json_encode($body['payload'] ?? null, JSON_UNESCAPED_UNICODE);
            if (strlen((string) $payload) > 200000) Http::fail('Mensaje demasiado grande', 413, 'too_large');
            $st = $this->db->prepare('INSERT INTO app_relay_messages (room, sender, event, payload) VALUES (?,?,?,?)');
            $st->execute([$room, $member, $event, $payload]);
            Http::json(['data' => ['id' => (int) $this->db->lastInsertId()]]);
        }

        if ($action === 'poll' && $method === 'POST') {
            if ($member === '') Http::fail('Falta el participante', 400, 'bad_input');
            $now = time();
            if (array_key_exists('info', $body) && $body['info'] !== null) {
                $info = json_encode($body['info'], JSON_UNESCAPED_UNICODE);
                $st = $this->db->prepare('INSERT INTO app_relay_presence (room, member, info, last_seen) VALUES (?,?,?,?)
                    ON DUPLICATE KEY UPDATE info = VALUES(info), last_seen = VALUES(last_seen)');
                $st->execute([$room, $member, $info, $now]);
            }
            // Limpieza ocasional.
            if (random_int(1, 50) === 1) {
                $this->db->exec('DELETE FROM app_relay_messages WHERE created_at < (NOW() - INTERVAL 15 MINUTE)');
                $this->db->prepare('DELETE FROM app_relay_presence WHERE last_seen < ?')->execute([$now - 3600]);
            }
            $since = (int) ($body['since'] ?? -1);
            if ($since < 0) {
                // Primera consulta: solo se reciben mensajes a partir de ahora.
                $st = $this->db->prepare('SELECT COALESCE(MAX(id),0) FROM app_relay_messages WHERE room = ?');
                $st->execute([$room]);
                $since = (int) $st->fetchColumn();
                $messages = [];
            } else {
                $st = $this->db->prepare('SELECT id, sender, event, payload FROM app_relay_messages
                    WHERE room = ? AND id > ? AND sender <> ? ORDER BY id ASC LIMIT 200');
                $st->execute([$room, $since, $member]);
                $messages = [];
                foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $since = max($since, (int) $row['id']);
                    $messages[] = ['id' => (int) $row['id'], 'from' => $row['sender'], 'event' => $row['event'],
                        'payload' => json_decode((string) $row['payload'], true)];
                }
                // Avanza también por los propios mensajes.
                $st = $this->db->prepare('SELECT COALESCE(MAX(id),0) FROM app_relay_messages WHERE room = ? AND id <= (SELECT COALESCE(MAX(id),0) FROM app_relay_messages WHERE room = ?)');
                $st->execute([$room, $room]);
                if ($messages === []) $since = max($since, (int) $st->fetchColumn());
            }
            $st = $this->db->prepare('SELECT member, info FROM app_relay_presence WHERE room = ? AND last_seen >= ?');
            $st->execute([$room, $now - self::PRESENCE_TTL]);
            $presence = [];
            foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $presence[$row['member']] = json_decode((string) $row['info'], true);
            }
            Http::json(['data' => ['since' => $since, 'messages' => $messages, 'presence' => $presence]]);
        }

        if ($action === 'leave' && $method === 'POST') {
            $this->db->prepare('DELETE FROM app_relay_presence WHERE room = ? AND member = ?')->execute([$room, $member]);
            Http::json(['data' => ['ok' => true]]);
        }

        Http::fail('Acción no válida', 404, 'not_found');
    }
}
