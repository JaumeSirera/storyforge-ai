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
