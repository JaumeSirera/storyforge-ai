-- Esquema MySQL 8 / MariaDB 10.5+ para Xandralyze (fase 1: evaluaciones).
-- Las cuentas de usuario siguen gestionadas por Lovable Cloud; aquí solo se
-- guarda el identificador del usuario (owner_id) para separar los datos.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS assessments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  area_key VARCHAR(80) NULL,
  prompt TEXT NULL,
  instructions TEXT NULL,
  questions JSON NOT NULL,
  rubric JSON NOT NULL,
  max_score DECIMAL(6,2) NOT NULL DEFAULT 10,
  handwriting_weight_pct INT NOT NULL DEFAULT 15,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  feedback_tone VARCHAR(30) NOT NULL DEFAULT 'formativo',
  time_limit_min INT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_assessments_owner (owner_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_submissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  assessment_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  candidate_name VARCHAR(200) NOT NULL,
  candidate_identifier VARCHAR(120) NULL,
  source_kind VARCHAR(20) NOT NULL DEFAULT 'handwritten',
  pages JSON NOT NULL,
  extracted_text MEDIUMTEXT NULL,
  handwriting JSON NULL,
  evaluation JSON NULL,
  score DECIMAL(6,2) NULL,
  max_score DECIMAL(6,2) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  graded_at TIMESTAMP(3) NULL,
  approval_status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  approval_note TEXT NOT NULL,
  approved_by CHAR(36) NULL,
  approved_at TIMESTAMP(3) NULL,
  transcription_segments JSON NOT NULL,
  scan_quality JSON NULL,
  ocr_updated_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_submissions_owner (owner_id, created_at),
  KEY idx_submissions_assessment (assessment_id, created_at),
  CONSTRAINT fk_submissions_assessment FOREIGN KEY (assessment_id)
    REFERENCES assessments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_candidates (
  id CHAR(36) NOT NULL PRIMARY KEY,
  assessment_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NULL,
  identifier VARCHAR(120) NULL,
  token VARCHAR(120) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  submission_id CHAR(36) NULL,
  expires_at TIMESTAMP(3) NULL,
  started_at TIMESTAMP(3) NULL,
  submitted_at TIMESTAMP(3) NULL,
  note TEXT NOT NULL,
  time_expired TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_candidates_token (token),
  KEY idx_candidates_owner (owner_id, created_at),
  KEY idx_candidates_assessment (assessment_id, created_at),
  CONSTRAINT fk_candidates_assessment FOREIGN KEY (assessment_id)
    REFERENCES assessments (id) ON DELETE CASCADE,
  CONSTRAINT fk_candidates_submission FOREIGN KEY (submission_id)
    REFERENCES assessment_submissions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_annotations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  submission_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  page_path VARCHAR(500) NOT NULL,
  page_index INT NOT NULL DEFAULT 0,
  kind VARCHAR(30) NOT NULL,
  x DECIMAL(8,4) NOT NULL,
  y DECIMAL(8,4) NOT NULL,
  w DECIMAL(8,4) NOT NULL,
  h DECIMAL(8,4) NOT NULL,
  correction TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_annotations_owner (owner_id, created_at),
  KEY idx_annotations_submission (submission_id, page_index),
  CONSTRAINT fk_annotations_submission FOREIGN KEY (submission_id)
    REFERENCES assessment_submissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_collaborators (
  id CHAR(36) NOT NULL PRIMARY KEY,
  assessment_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_collaborators (assessment_id, user_id),
  KEY idx_collaborators_owner (owner_id),
  CONSTRAINT fk_collaborators_assessment FOREIGN KEY (assessment_id)
    REFERENCES assessments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_bank_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  prompt TEXT NOT NULL,
  type VARCHAR(30) NOT NULL,
  subject VARCHAR(80) NULL,
  area_key VARCHAR(80) NULL,
  tags JSON NOT NULL,
  question JSON NOT NULL,
  version INT NOT NULL DEFAULT 1,
  times_used INT NOT NULL DEFAULT 0,
  source_assessment_id CHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_bank_owner (owner_id, created_at),
  CONSTRAINT fk_bank_assessment FOREIGN KEY (source_assessment_id)
    REFERENCES assessments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_audit_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  assessment_id CHAR(36) NOT NULL,
  candidate_id CHAR(36) NOT NULL,
  event VARCHAR(60) NOT NULL,
  ip VARCHAR(60) NULL,
  user_agent VARCHAR(400) NULL,
  client_version VARCHAR(60) NULL,
  detail JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_owner (owner_id, created_at),
  KEY idx_audit_candidate (candidate_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_bank_versions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  question JSON NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_bank_version_item (item_id, version),
  KEY idx_bank_version_owner (owner_id, created_at),
  CONSTRAINT fk_bank_version_item FOREIGN KEY (item_id)
    REFERENCES question_bank_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_invite_emails (
  id CHAR(36) NOT NULL PRIMARY KEY,
  assessment_id CHAR(36) NOT NULL,
  candidate_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  recipient VARCHAR(320) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  message_id VARCHAR(200) NULL,
  error_message TEXT NULL,
  last_attempt_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_invite_candidate (candidate_id),
  KEY idx_invite_assessment (assessment_id, created_at),
  CONSTRAINT fk_invite_candidate FOREIGN KEY (candidate_id)
    REFERENCES assessment_candidates (id) ON DELETE CASCADE,
  CONSTRAINT fk_invite_assessment FOREIGN KEY (assessment_id)
    REFERENCES assessments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Fase 2: simulaciones, partidas, informes y consumo de IA.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS simulations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  objective TEXT NOT NULL,
  prompt TEXT NOT NULL,
  topic VARCHAR(200) NULL,
  duration_min INT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  cover_image_url TEXT NULL,
  story JSON NOT NULL,
  evaluation_criteria JSON NOT NULL,
  videos JSON NOT NULL,
  candidate_fields JSON NOT NULL,
  area_key VARCHAR(80) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_simulations_owner (owner_id, created_at),
  KEY idx_simulations_public (is_public, status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simulation_characters (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  simulation_id CHAR(36) NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  image_path VARCHAR(500) NOT NULL,
  consent_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_characters_user (user_id, created_at),
  CONSTRAINT fk_characters_simulation FOREIGN KEY (simulation_id)
    REFERENCES simulations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  simulation_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  current_node_id VARCHAR(120) NULL,
  score INT NOT NULL DEFAULT 0,
  stars INT NOT NULL DEFAULT 0,
  achievements JSON NOT NULL,
  answers JSON NOT NULL,
  competency_scores JSON NOT NULL,
  report JSON NULL,
  candidate_name VARCHAR(200) NULL,
  candidate_email VARCHAR(320) NULL,
  candidate_fields_data JSON NOT NULL,
  admin_feedback TEXT NULL,
  admin_feedback_at TIMESTAMP(3) NULL,
  report_email_sent_at TIMESTAMP(3) NULL,
  report_email_to VARCHAR(320) NULL,
  started_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_sessions_user (user_id, created_at),
  KEY idx_sessions_simulation (simulation_id, created_at),
  CONSTRAINT fk_sessions_simulation FOREIGN KEY (simulation_id)
    REFERENCES simulations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simulation_invitations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  simulation_id CHAR(36) NOT NULL,
  token VARCHAR(120) NOT NULL,
  note TEXT NULL,
  expires_at TIMESTAMP(3) NULL,
  max_uses INT NULL,
  uses_count INT NOT NULL DEFAULT 0,
  revoked_at TIMESTAMP(3) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_sim_invitations_token (token),
  KEY idx_sim_invitations_simulation (simulation_id, created_at),
  CONSTRAINT fk_sim_invitations_simulation FOREIGN KEY (simulation_id)
    REFERENCES simulations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS simulation_revisions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  simulation_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  action VARCHAR(60) NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NULL,
  note TEXT NULL,
  summary JSON NOT NULL,
  snapshot JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_sim_revisions_simulation (simulation_id, created_at),
  CONSTRAINT fk_sim_revisions_simulation FOREIGN KEY (simulation_id)
    REFERENCES simulations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_email_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  simulation_id CHAR(36) NULL,
  owner_id CHAR(36) NOT NULL,
  recipient VARCHAR(320) NOT NULL,
  subject VARCHAR(300) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  auto TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_report_email_owner (owner_id, created_at),
  KEY idx_report_email_session (session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usage_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  simulation_id CHAR(36) NULL,
  action VARCHAR(30) NOT NULL,
  provider VARCHAR(30) NOT NULL,
  model VARCHAR(120) NULL,
  input_tokens INT NULL,
  output_tokens INT NULL,
  seconds DECIMAL(12,3) NULL,
  characters INT NULL,
  units INT NULL,
  cost_raw_cents DECIMAL(12,4) NOT NULL DEFAULT 0,
  margin_pct DECIMAL(8,3) NOT NULL DEFAULT 0,
  total_cents DECIMAL(12,4) NOT NULL DEFAULT 0,
  pays_platform TINYINT(1) NOT NULL DEFAULT 0,
  billed TINYINT(1) NOT NULL DEFAULT 0,
  metadata JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_usage_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
