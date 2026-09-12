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
            'shared' => 'self',
            'columns' => ['id', 'owner_id', 'title', 'area_key', 'prompt', 'instructions', 'questions', 'rubric', 'max_score', 'handwriting_weight_pct', 'status', 'feedback_tone', 'time_limit_min', 'created_at', 'updated_at'],
            'json' => ['questions', 'rubric'],
            'insertable' => ['id', 'title', 'area_key', 'prompt', 'instructions', 'questions', 'rubric', 'max_score', 'handwriting_weight_pct', 'status', 'feedback_tone', 'time_limit_min'],
            'updatable' => ['title', 'area_key', 'prompt', 'instructions', 'questions', 'rubric', 'max_score', 'handwriting_weight_pct', 'status', 'feedback_tone', 'time_limit_min'],
        ],
        'assessment_candidates' => [
            'owner' => 'owner_id',
            'shared' => 'assessment_id',
            'columns' => ['id', 'assessment_id', 'owner_id', 'name', 'email', 'identifier', 'token', 'status', 'submission_id', 'expires_at', 'started_at', 'submitted_at', 'note', 'time_expired', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'assessment_id', 'name', 'email', 'identifier', 'token', 'status', 'note', 'expires_at'],
            'updatable' => ['name', 'email', 'identifier', 'status', 'submission_id', 'expires_at', 'started_at', 'submitted_at', 'note', 'time_expired'],
            'defaults' => ['note' => '', 'status' => 'pendiente'],
        ],
        'assessment_submissions' => [
            'owner' => 'owner_id',
            'shared' => 'assessment_id',
            'columns' => ['id', 'assessment_id', 'owner_id', 'candidate_name', 'candidate_identifier', 'source_kind', 'pages', 'extracted_text', 'handwriting', 'evaluation', 'score', 'max_score', 'status', 'error_message', 'graded_at', 'approval_status', 'approval_note', 'approved_by', 'approved_at', 'transcription_segments', 'scan_quality', 'ocr_updated_at', 'created_at', 'updated_at'],
            'json' => ['pages', 'handwriting', 'evaluation', 'transcription_segments', 'scan_quality'],
            'insertable' => ['id', 'assessment_id', 'candidate_name', 'candidate_identifier', 'source_kind', 'pages', 'extracted_text', 'handwriting', 'evaluation', 'score', 'max_score', 'status', 'error_message', 'graded_at', 'approval_status', 'approval_note', 'approved_by', 'approved_at', 'transcription_segments', 'scan_quality', 'ocr_updated_at'],
            'defaults' => ['approval_status' => 'pendiente', 'approval_note' => '', 'transcription_segments' => []],
            'updatable' => ['pages', 'extracted_text', 'handwriting', 'evaluation', 'score', 'max_score', 'status', 'error_message', 'graded_at', 'approval_status', 'approval_note', 'approved_by', 'approved_at', 'transcription_segments', 'scan_quality', 'ocr_updated_at'],
        ],
        'assessment_annotations' => [
            'owner' => 'owner_id',
            'shared' => 'submission_id',
            'columns' => ['id', 'submission_id', 'owner_id', 'page_path', 'page_index', 'kind', 'x', 'y', 'w', 'h', 'correction', 'comment', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'submission_id', 'page_path', 'page_index', 'kind', 'x', 'y', 'w', 'h', 'correction', 'comment'],
            'updatable' => ['kind', 'x', 'y', 'w', 'h', 'correction', 'comment'],
            'defaults' => ['correction' => '', 'comment' => '', 'page_index' => 0],
        ],
        'assessment_collaborators' => [
            'owner' => 'owner_id',
            'shared' => 'assessment_id',
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
        'question_bank_versions' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'item_id', 'owner_id', 'version', 'question', 'note', 'created_at'],
            'json' => ['question'],
            'insertable' => ['id', 'item_id', 'version', 'question', 'note'],
            'defaults' => ['note' => ''],
            'updatable' => [],
            'immutable' => true,
        ],
        'candidate_invite_emails' => [
            'owner' => 'owner_id',
            'shared' => 'assessment_id',
            'columns' => ['id', 'assessment_id', 'candidate_id', 'owner_id', 'recipient', 'status', 'attempts', 'message_id', 'error_message', 'last_attempt_at', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'assessment_id', 'candidate_id', 'recipient', 'status', 'attempts', 'message_id', 'error_message', 'last_attempt_at'],
            'updatable' => ['status', 'attempts', 'message_id', 'error_message', 'last_attempt_at'],
        ],
        'exam_audit_log' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'owner_id', 'assessment_id', 'candidate_id', 'event', 'ip', 'user_agent', 'client_version', 'detail', 'created_at'],
            'json' => ['detail'],
            'insertable' => ['id', 'owner_id', 'assessment_id', 'candidate_id', 'event', 'ip', 'user_agent', 'client_version', 'detail'],
            'updatable' => [],
            'immutable' => true,
        ],
        'simulations' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'owner_id', 'title', 'objective', 'prompt', 'topic', 'duration_min', 'status', 'is_public', 'cover_image_url', 'story', 'evaluation_criteria', 'videos', 'candidate_fields', 'area_key', 'created_at', 'updated_at'],
            'json' => ['story', 'evaluation_criteria', 'videos', 'candidate_fields'],
            'insertable' => ['id', 'title', 'objective', 'prompt', 'topic', 'duration_min', 'status', 'is_public', 'cover_image_url', 'story', 'evaluation_criteria', 'videos', 'candidate_fields', 'area_key'],
            'updatable' => ['title', 'objective', 'prompt', 'topic', 'duration_min', 'status', 'is_public', 'cover_image_url', 'story', 'evaluation_criteria', 'videos', 'candidate_fields', 'area_key'],
            'defaults' => ['story' => [], 'evaluation_criteria' => [], 'videos' => [], 'candidate_fields' => []],
        ],
        'simulation_characters' => [
            'owner' => 'user_id',
            'columns' => ['id', 'user_id', 'simulation_id', 'name', 'description', 'image_path', 'consent_acknowledged', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'simulation_id', 'name', 'description', 'image_path', 'consent_acknowledged'],
            'updatable' => ['simulation_id', 'name', 'description', 'image_path', 'consent_acknowledged'],
        ],
        'simulation_revisions' => [
            'owner' => 'actor_id',
            'shared' => 'simulation_id',
            'columns' => ['id', 'simulation_id', 'actor_id', 'action', 'from_status', 'to_status', 'note', 'summary', 'snapshot', 'created_at'],
            'json' => ['summary', 'snapshot'],
            'insertable' => ['id', 'simulation_id', 'action', 'from_status', 'to_status', 'note', 'summary', 'snapshot'],
            'defaults' => ['summary' => [], 'snapshot' => []],
            'updatable' => [],
            'immutable' => true,
        ],
        'simulation_invitations' => [
            'owner' => 'created_by',
            'shared' => 'simulation_id',
            'columns' => ['id', 'simulation_id', 'token', 'note', 'expires_at', 'max_uses', 'uses_count', 'revoked_at', 'created_by', 'created_at'],
            'json' => [],
            'insertable' => ['id', 'simulation_id', 'token', 'note', 'expires_at', 'max_uses', 'uses_count'],
            'updatable' => ['note', 'expires_at', 'max_uses', 'uses_count', 'revoked_at'],
        ],
        'sessions' => [
            'owner' => 'user_id',
            'shared' => 'simulation_id',
            'columns' => ['id', 'simulation_id', 'user_id', 'current_node_id', 'score', 'stars', 'achievements', 'answers', 'competency_scores', 'report', 'started_at', 'completed_at', 'updated_at', 'candidate_name', 'candidate_email', 'candidate_fields_data', 'admin_feedback', 'admin_feedback_at', 'report_email_sent_at', 'report_email_to'],
            'json' => ['achievements', 'answers', 'competency_scores', 'report', 'candidate_fields_data'],
            'insertable' => ['id', 'simulation_id', 'current_node_id', 'score', 'stars', 'achievements', 'answers', 'competency_scores', 'report', 'started_at', 'completed_at', 'candidate_name', 'candidate_email', 'candidate_fields_data'],
            'defaults' => ['achievements' => [], 'answers' => [], 'competency_scores' => [], 'candidate_fields_data' => []],
            'updatable' => ['current_node_id', 'score', 'stars', 'achievements', 'answers', 'competency_scores', 'report', 'completed_at', 'candidate_name', 'candidate_email', 'candidate_fields_data', 'admin_feedback', 'admin_feedback_at', 'report_email_sent_at', 'report_email_to'],
        ],
        'report_email_log' => [
            'owner' => 'owner_id',
            'columns' => ['id', 'session_id', 'simulation_id', 'owner_id', 'recipient', 'subject', 'status', 'attempts', 'error_message', 'auto', 'created_at', 'updated_at'],
            'json' => [],
            'insertable' => ['id', 'session_id', 'simulation_id', 'recipient', 'subject', 'status', 'attempts', 'error_message', 'auto'],
            'updatable' => ['status', 'attempts', 'error_message'],
        ],
        'usage_events' => [
            'owner' => 'user_id',
            'columns' => ['id', 'user_id', 'simulation_id', 'action', 'provider', 'model', 'input_tokens', 'output_tokens', 'seconds', 'characters', 'units', 'cost_raw_cents', 'margin_pct', 'total_cents', 'pays_platform', 'billed', 'metadata', 'created_at'],
            'json' => ['metadata'],
            'insertable' => ['id', 'user_id', 'simulation_id', 'action', 'provider', 'model', 'input_tokens', 'output_tokens', 'seconds', 'characters', 'units', 'cost_raw_cents', 'margin_pct', 'total_cents', 'pays_platform', 'billed', 'metadata'],
            'updatable' => ['billed'],
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
    public function list(string $resource, ?string $userId, array $query): array
    {
        $meta = self::meta($resource);
        /** @var list<string> $columns */
        $columns = $meta['columns'];
        $owner = (string) $meta['owner'];

        $where = [];
        $params = [];
        $scope = $this->scopeWhere($resource, $meta, $userId);
        if ($scope !== null) {
            $where[] = $scope;
            $params = array_merge($params, $this->scopeParams($meta, (string) $userId));
        }

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
            $where === [] ? '1 = 1' : implode(' AND ', $where),
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
    public function find(string $resource, ?string $userId, string $id): ?array
    {
        $meta = self::meta($resource);
        $scope = $this->scopeWhere($resource, $meta, $userId);
        $sql = sprintf(
            'SELECT %s FROM `%s` WHERE `id` = :id%s LIMIT 1',
            $this->select($meta['columns']),
            $resource,
            $scope === null ? '' : ' AND ' . $scope,
        );
        $args = ['id' => $id];
        if ($scope !== null) {
            $args = array_merge($args, $this->scopeParams($meta, (string) $userId));
        }

        $row = $this->db->one($sql, $args);
        return $row === null ? null : $this->decode($row, $meta['json']);
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function create(string $resource, ?string $userId, array $input): array
    {
        $meta = self::meta($resource);
        $id = isset($input['id']) && is_string($input['id']) && $input['id'] !== ''
            ? $input['id']
            : self::uuid();

        $ownerColumn = (string) $meta['owner'];
        $owner = $userId ?? (isset($input[$ownerColumn]) ? (string) $input[$ownerColumn] : '');
        if ($owner === '') {
            Http::fail('Falta el propietario del registro', 400, 'missing_owner');
        }

        $values = ['id' => $id, $ownerColumn => $owner];
        foreach ($meta['insertable'] as $column) {
            if ($column === 'id' || $column === $ownerColumn || !array_key_exists($column, $input)) {
                continue;
            }
            $values[$column] = $this->encode($column, $input[$column], $meta['json']);
        }

        // Columnas obligatorias sin valor: se rellenan con su valor por defecto.
        /** @var array<string,mixed> $defaults */
        $defaults = $meta['defaults'] ?? [];
        foreach ($defaults as $column => $default) {
            if (!array_key_exists($column, $values) || $values[$column] === null) {
                $values[$column] = $this->encode($column, $default, $meta['json']);
            }
        }


        $names = array_keys($values);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $resource,
            implode(', ', array_map(fn (string $c): string => "`{$c}`", $names)),
            implode(', ', array_map(fn (string $c): string => ":{$c}", $names)),
        );
        $this->db->run($sql, $values);

        $created = $this->find($resource, $userId ?? $owner, $id);
        if ($created === null) {
            Http::fail('No se ha podido guardar', 500, 'insert_failed');
        }
        return $created;
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function update(string $resource, ?string $userId, string $id, array $input): array
    {
        $meta = self::meta($resource);
        if (($meta['immutable'] ?? false) === true) {
            Http::fail('Este recurso no se puede modificar', 405, 'immutable');
        }

        $scope = $this->scopeWhere($resource, $meta, $userId);
        $sets = [];
        $params = ['id' => $id];
        if ($scope !== null) {
            $params = array_merge($params, $this->scopeParams($meta, (string) $userId));
        }

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
            'UPDATE `%s` SET %s WHERE `id` = :id%s',
            $resource,
            implode(', ', $sets),
            $scope === null ? '' : ' AND ' . $scope,
        );
        $this->db->run($sql, $params);

        $updated = $this->find($resource, $userId, $id);
        if ($updated === null) {
            Http::fail('No encontrado', 404, 'not_found');
        }
        return $updated;
    }

    public function delete(string $resource, ?string $userId, string $id): int
    {
        $meta = self::meta($resource);
        if (($meta['immutable'] ?? false) === true) {
            Http::fail('Este recurso no se puede borrar', 405, 'immutable');
        }
        $scope = $this->scopeWhere($resource, $meta, $userId);
        $sql = sprintf(
            'DELETE FROM `%s` WHERE `id` = :id%s',
            $resource,
            $scope === null ? '' : ' AND ' . $scope,
        );
        $args = ['id' => $id];
        if ($scope !== null) {
            $args = array_merge($args, $this->scopeParams($meta, (string) $userId));
        }

        return $this->db->run($sql, $args);
    }

    /**
     * Condición de acceso: el dueño de la fila o un colaborador de la
     * evaluación (equivale a las reglas que antes vivían en la base de datos).
     * Devuelve null cuando la llamada es de servicio (sin usuario).
     *
     * @param array<string,mixed> $meta
     */
    private function scopeWhere(string $resource, array $meta, ?string $userId): ?string
    {
        if ($userId === null) {
            return null;
        }
        $owner = "`{$meta['owner']}` = :owner";
        $shared = $meta['shared'] ?? null;

        if ($shared === 'self') {
            return "({$owner} OR `id` IN (SELECT `assessment_id` FROM `assessment_collaborators` WHERE `user_id` = :owner2))";
        }
        if ($shared === 'assessment_id') {
            return "({$owner} OR `assessment_id` IN (SELECT `assessment_id` FROM `assessment_collaborators` WHERE `user_id` = :owner2))";
        }
        if ($shared === 'simulation_id') {
            return "({$owner} OR `simulation_id` IN (SELECT `id` FROM `simulations` WHERE `owner_id` = :owner2))";
        }
        if ($shared === 'submission_id') {
            return "({$owner} OR `submission_id` IN (SELECT s.`id` FROM `assessment_submissions` s"
                . " JOIN `assessment_collaborators` c ON c.`assessment_id` = s.`assessment_id`"
                . " WHERE c.`user_id` = :owner2))";
        }
        return $owner;
    }

    /**
     * Parámetros que necesita la condición de acceso.
     *
     * @param array<string,mixed> $meta
     * @return array<string,string>
     */
    private function scopeParams(array $meta, string $userId): array
    {
        $params = ['owner' => $userId];
        if (isset($meta['shared'])) {
            $params['owner2'] = $userId;
        }
        return $params;
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
