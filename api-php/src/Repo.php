<?php

declare(strict_types=1);

namespace Xandralyze;

/**
 * Acceso a datos con lista blanca de recursos y columnas.
 * Cada consulta se limita siempre a las filas del usuario que pide.
 */
final class Repo
{
    /**
     * @var array<string,array{owner:string,columns:list<string>,json:list<string>,insertable:list<string>,updatable:list<string>,immutable?:bool}>
     */
    private const RESOURCES = [
        'assessments' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'owner_id', 'title', 'area_key', 'prompt', 'instructions', 'questions', 'rubric', 'max_score', 'handwriting_weight_pct', 'status', 'feedback_tone', 'time_limit_min', 'created_at', 'updated_at'],
            'json' => ['questions', 'rubric'],
            'insertable' => ['id', 'title', 'area_key', 'prompt', 'instructions', 'questions', 'rubric', 'max_score', 'handwriting_weight_pct', 'status', 'feedback_tone', 'time_limit_min'],
            'updatable' => ['title', 'area_key', 'prompt', 'instructions', 'questions', 'rubric', 'max_score', 'handwriting_weight_pct', 'status', 'feedback_tone', 'time_limit_min'],
        ],
        'assessment_candidates' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'assessment_id', 'owner_id', 'name', 'email', 'identifier', 'token', 'status', 'submission_id', 'expires_at', 'started_at', 'submitted_at', 'note', 'time_expired', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'assessment_id', 'name', 'email', 'identifier', 'token', 'status', 'note', 'expires_at'],
            'updatable' => ['name', 'email', 'identifier', 'status', 'submission_id', 'expires_at', 'started_at', 'submitted_at', 'note', 'time_expired'],
        ],
        'assessment_submissions' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'assessment_id', 'owner_id', 'candidate_name', 'candidate_identifier', 'source_kind', 'pages', 'extracted_text', 'handwriting', 'evaluation', 'score', 'max_score', 'status', 'error_message', 'graded_at', 'approval_status', 'approval_note', 'approved_by', 'approved_at', 'transcription_segments', 'scan_quality', 'ocr_updated_at', 'created_at', 'updated_at'],
            'json' => ['pages', 'handwriting', 'evaluation', 'transcription_segments', 'scan_quality'],
            'insertable' => ['id', 'assessment_id', 'candidate_name', 'candidate_identifier', 'source_kind', 'pages', 'extracted_text', 'status'],
            'updatable' => ['pages', 'extracted_text', 'handwriting', 'evaluation', 'score', 'max_score', 'status', 'error_message', 'graded_at', 'approval_status', 'approval_note', 'approved_by', 'approved_at', 'transcription_segments', 'scan_quality', 'ocr_updated_at'],
        ],
        'assessment_annotations' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'submission_id', 'owner_id', 'page_path', 'page_index', 'kind', 'x', 'y', 'w', 'h', 'correction', 'comment', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'submission_id', 'page_path', 'page_index', 'kind', 'x', 'y', 'w', 'h', 'correction', 'comment'],
            'updatable' => ['kind', 'x', 'y', 'w', 'h', 'correction', 'comment'],
        ],
        'assessment_collaborators' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'assessment_id', 'owner_id', 'user_id', 'email', 'role', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'assessment_id', 'user_id', 'email', 'role'],
            'updatable' => ['role'],
        ],
        'question_bank_items' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'owner_id', 'prompt', 'type', 'subject', 'area_key', 'tags', 'question', 'version', 'times_used', 'source_assessment_id', 'created_at', 'updated_at'],
            'json' => ['tags', 'question'],
            'insertable' => ['id', 'prompt', 'type', 'subject', 'area_key', 'tags', 'question', 'source_assessment_id'],
            'updatable' => ['prompt', 'type', 'subject', 'area_key', 'tags', 'question', 'version', 'times_used'],
        ],
        'exam_audit_log' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'owner_id', 'assessment_id', 'candidate_id', 'event', 'ip', 'user_agent', 'client_version', 'detail', 'created_at'],
            'json' => ['detail'],
            'insertable' => ['id', 'owner_id', 'assessment_id', 'candidate_id', 'event', 'ip', 'user_agent', 'client_version', 'detail'],
            'updatable' => [],
            'immutable' => true,
        ],
    ];

    public function __construct(private Db $db)
    {
    }

    public static function isResource(string $name): bool
    {
        return isset(self::RESOURCES[$name]);
    }

    /** @return array<string,mixed> */
    private static function meta(string $resource): array
    {
        if (!isset(self::RESOURCES[$resource])) {
            Http::fail('Recurso no disponible', 404, 'unknown_resource');
        }
        return self::RESOURCES[$resource];
    }

    /**
     * @param array<string,string> $query
     * @return list<array<string,mixed>>
     */
    public function list(string $resource, string $userId, array $query): array
    {
        $meta = self::meta($resource);
        /** @var list<string> $columns */
        $columns = $meta['columns'];
        $owner = (string) $meta['owner'];

        $where = ["`{$owner}` = :owner"];
        $params = ['owner' => $userId];
        foreach ($query as $key => $value) {
            if (!in_array($key, $columns, true)) {
                continue;
            }
            $where[] = "`{$key}` = :f_{$key}";
            $params["f_{$key}"] = $value;
        }

        $order = $query['order'] ?? 'created_at.desc';
        [$orderColumn, $orderDir] = array_pad(explode('.', $order, 2), 2, 'desc');
        if (!in_array($orderColumn, $columns, true)) {
            $orderColumn = 'created_at';
        }
        $orderDir = strtolower($orderDir) === 'asc' ? 'ASC' : 'DESC';

        $limit = max(1, min(200, (int) ($query['limit'] ?? 100)));
        $offset = max(0, (int) ($query['offset'] ?? 0));

        $sql = sprintf(
            'SELECT %s FROM `%s` WHERE %s ORDER BY `%s` %s LIMIT %d OFFSET %d',
            $this->select($columns),
            $resource,
            implode(' AND ', $where),
            $orderColumn,
            $orderDir,
            $limit,
            $offset,
        );

        return array_map(
            fn (array $row): array => $this->decode($row, $meta['json']),
            $this->db->all($sql, $params),
        );
    }

    /** @return array<string,mixed>|null */
    public function find(string $resource, string $userId, string $id): ?array
    {
        $meta = self::meta($resource);
        $sql = sprintf(
            'SELECT %s FROM `%s` WHERE `id` = :id AND `%s` = :owner LIMIT 1',
            $this->select($meta['columns']),
            $resource,
            $meta['owner'],
        );
        $row = $this->db->one($sql, ['id' => $id, 'owner' => $userId]);
        return $row === null ? null : $this->decode($row, $meta['json']);
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function create(string $resource, string $userId, array $input): array
    {
        $meta = self::meta($resource);
        $id = isset($input['id']) && is_string($input['id']) && $input['id'] !== ''
            ? $input['id']
            : self::uuid();

        $values = ['id' => $id, (string) $meta['owner'] => $userId];
        foreach ($meta['insertable'] as $column) {
            if ($column === 'id' || !array_key_exists($column, $input)) {
                continue;
            }
            $values[$column] = $this->encode($column, $input[$column], $meta['json']);
        }

        $names = array_keys($values);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $resource,
            implode(', ', array_map(fn (string $c): string => "`{$c}`", $names)),
            implode(', ', array_map(fn (string $c): string => ":{$c}", $names)),
        );
        $this->db->run($sql, $values);

        $created = $this->find($resource, $userId, $id);
        if ($created === null) {
            Http::fail('No se ha podido guardar', 500, 'insert_failed');
        }
        return $created;
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function update(string $resource, string $userId, string $id, array $input): array
    {
        $meta = self::meta($resource);
        if (($meta['immutable'] ?? false) === true) {
            Http::fail('Este recurso no se puede modificar', 405, 'immutable');
        }

        $sets = [];
        $params = ['id' => $id, 'owner' => $userId];
        foreach ($meta['updatable'] as $column) {
            if (!array_key_exists($column, $input)) {
                continue;
            }
            $sets[] = "`{$column}` = :s_{$column}";
            $params["s_{$column}"] = $this->encode($column, $input[$column], $meta['json']);
        }
        if ($sets === []) {
            Http::fail('No hay cambios que guardar', 400, 'no_changes');
        }
        $sets[] = '`updated_at` = CURRENT_TIMESTAMP(3)';

        $sql = sprintf(
            'UPDATE `%s` SET %s WHERE `id` = :id AND `%s` = :owner',
            $resource,
            implode(', ', $sets),
            $meta['owner'],
        );
        $this->db->run($sql, $params);

        $updated = $this->find($resource, $userId, $id);
        if ($updated === null) {
            Http::fail('No encontrado', 404, 'not_found');
        }
        return $updated;
    }

    public function delete(string $resource, string $userId, string $id): int
    {
        $meta = self::meta($resource);
        if (($meta['immutable'] ?? false) === true) {
            Http::fail('Este recurso no se puede borrar', 405, 'immutable');
        }
        $sql = sprintf('DELETE FROM `%s` WHERE `id` = :id AND `%s` = :owner', $resource, $meta['owner']);
        return $this->db->run($sql, ['id' => $id, 'owner' => $userId]);
    }

    /** @param list<string> $columns */
    private function select(array $columns): string
    {
        return implode(', ', array_map(fn (string $c): string => "`{$c}`", $columns));
    }

    /**
     * @param array<string,mixed> $row
     * @param list<string> $jsonColumns
     * @return array<string,mixed>
     */
    private function decode(array $row, array $jsonColumns): array
    {
        foreach ($jsonColumns as $column) {
            if (!array_key_exists($column, $row)) {
                continue;
            }
            $value = $row[$column];
            $row[$column] = is_string($value) ? json_decode($value, true) : $value;
        }
        return $row;
    }

    /** @param list<string> $jsonColumns */
    private function encode(string $column, mixed $value, array $jsonColumns): mixed
    {
        if (in_array($column, $jsonColumns, true)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE);
        }
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE);
        }
        return $value;
    }

    public static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
