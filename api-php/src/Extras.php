<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Pequeños servicios que antes dependían de la base anterior:
 *  - Áreas de práctica (por defecto + las de cada usuario).
 *  - Búsqueda de personas por email o por id (compartir evaluaciones,
 *    historial de cambios).
 */
final class Extras
{
    private const DEFAULT_AREAS = [
        'entrevistas' => 'Entrevistas',
        'formacion' => 'Formación',
        'negociacion' => 'Negociación',
        'mediacion' => 'Mediación',
        'terapia_grupal' => 'Terapia grupal',
        'dinamicas_equipo' => 'Dinámicas de equipo',
        'investigacion' => 'Investigación',
        'educacion' => 'Educación',
        'deportes' => 'Deportes',
        'seleccion_personal' => 'Selección de personal',
        'formacion_corporativa' => 'Formación corporativa',
        'negociacion_comercial' => 'Negociación comercial',
        'atencion_cliente' => 'Atención al cliente',
        'liderazgo' => 'Liderazgo y gestión de equipos',
        'simulaciones_medicas' => 'Simulaciones médicas',
    ];

    public function __construct(private Db $db)
    {
    }

    private function ensureAreas(): void
    {
        $this->db->run(
            'CREATE TABLE IF NOT EXISTS app_practice_areas (
              id CHAR(36) NOT NULL PRIMARY KEY,
              user_id CHAR(36) NOT NULL,
              `key` VARCHAR(60) NOT NULL,
              label VARCHAR(120) NOT NULL,
              description VARCHAR(500) NULL,
              created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              UNIQUE KEY uq_area_user_key (user_id, `key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    /** @return list<array<string,mixed>> */
    public function listAreas(string $userId): array
    {
        $this->ensureAreas();
        $out = [];
        foreach (self::DEFAULT_AREAS as $key => $label) {
            $out[] = ['id' => 'default-' . $key, 'key' => $key, 'label' => $label, 'description' => null, 'is_default' => true];
        }
        $rows = $this->db->all(
            'SELECT id, `key`, label, description FROM app_practice_areas WHERE user_id = :u ORDER BY label ASC',
            ['u' => $userId]
        );
        foreach ($rows as $r) {
            $out[] = ['id' => (string) $r['id'], 'key' => (string) $r['key'], 'label' => (string) $r['label'], 'description' => $r['description'], 'is_default' => false];
        }

        return $out;
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    public function createArea(string $userId, array $body): array
    {
        $this->ensureAreas();
        $key = preg_replace('/[^a-z0-9_]/', '', (string) ($body['key'] ?? '')) ?? '';
        $label = mb_substr(trim((string) ($body['label'] ?? '')), 0, 120);
        if ($key === '' || mb_strlen($label) < 2) {
            Http::fail('Nombre de área no válido', 400, 'bad_area');
        }
        if (isset(self::DEFAULT_AREAS[$key]) || $this->db->one(
            'SELECT 1 AS ok FROM app_practice_areas WHERE user_id = :u AND `key` = :k',
            ['u' => $userId, 'k' => $key]
        ) !== null) {
            Http::fail('Ya existe un área con ese nombre', 409, 'duplicate');
        }
        $id = Accounts::uuid();
        $desc = trim((string) ($body['description'] ?? ''));
        $this->db->run(
            'INSERT INTO app_practice_areas (id, user_id, `key`, label, description) VALUES (:id, :u, :k, :l, :d)',
            ['id' => $id, 'u' => $userId, 'k' => $key, 'l' => $label, 'd' => $desc !== '' ? mb_substr($desc, 0, 500) : null]
        );

        return ['id' => $id, 'key' => $key, 'label' => $label, 'description' => $desc !== '' ? $desc : null, 'is_default' => false];
    }

    public function deleteArea(string $userId, string $id): array
    {
        $this->ensureAreas();
        $this->db->run('DELETE FROM app_practice_areas WHERE id = :id AND user_id = :u', ['id' => $id, 'u' => $userId]);

        return ['ok' => true];
    }

    /**
     * Personas por email (una) o por ids (varias). Solo devuelve id, email y nombre.
     * @param array<string,mixed> $body @return list<array<string,mixed>>
     */
    public function lookupPeople(array $body): array
    {
        if (isset($body['email'])) {
            $row = $this->db->one(
                'SELECT id, email, full_name FROM app_users WHERE LOWER(email) = :e LIMIT 1',
                ['e' => strtolower(trim((string) $body['email']))]
            );

            return $row !== null ? [$row] : [];
        }
        $ids = array_values(array_filter(
            is_array($body['ids'] ?? null) ? $body['ids'] : [],
            static fn ($v): bool => is_string($v) && preg_match('/^[0-9a-f-]{36}$/i', $v) === 1
        ));
        $ids = array_slice(array_unique($ids), 0, 200);
        if ($ids === []) {
            return [];
        }
        $params = [];
        $marks = [];
        foreach ($ids as $i => $id) {
            $marks[] = ':i' . $i;
            $params['i' . $i] = $id;
        }

        return $this->db->all('SELECT id, email, full_name FROM app_users WHERE id IN (' . implode(',', $marks) . ')', $params);
    }
}
