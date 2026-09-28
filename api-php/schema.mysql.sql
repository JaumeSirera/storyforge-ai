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

-- =====================================================================
-- Fase 3: grabaciones de captura y facturación
-- =====================================================================

CREATE TABLE IF NOT EXISTS capture_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  simulation_id CHAR(36) NULL,
  game_session_id CHAR(36) NULL,
  title VARCHAR(300) NOT NULL,
  area_key VARCHAR(80) NULL,
  mode VARCHAR(40) NOT NULL DEFAULT 'individual',
  capture_mode VARCHAR(40) NOT NULL DEFAULT 'camera',
  record_screen TINYINT(1) NOT NULL DEFAULT 0,
  consent_recording TINYINT(1) NOT NULL DEFAULT 0,
  consent_face_analysis TINYINT(1) NOT NULL DEFAULT 0,
  consent_text TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  retention_days INT NOT NULL DEFAULT 30,
  delete_after TIMESTAMP(3) NULL,
  started_at TIMESTAMP(3) NULL,
  ended_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_capture_sessions_owner (owner_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_participants (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  identifier VARCHAR(120) NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'participante',
  photo_path VARCHAR(500) NULL,
  color VARCHAR(20) NULL,
  joined_at_sec DECIMAL(12,3) NULL,
  is_late TINYINT(1) NOT NULL DEFAULT 0,
  user_id CHAR(36) NULL,
  joined_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_capture_participants_session (capture_session_id),
  KEY idx_capture_participants_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_recordings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  participant_id CHAR(36) NULL,
  owner_id CHAR(36) NOT NULL,
  kind VARCHAR(40) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NULL,
  size_bytes BIGINT NULL,
  duration_sec DECIMAL(12,3) NULL,
  sync_offset_ms INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'ready',
  error_message TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_capture_recordings_session (capture_session_id),
  KEY idx_capture_recordings_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_transcript_segments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  recording_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  participant_id CHAR(36) NULL,
  speaker_label VARCHAR(120) NULL,
  start_sec DECIMAL(12,3) NOT NULL DEFAULT 0,
  end_sec DECIMAL(12,3) NOT NULL DEFAULT 0,
  text MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_transcript_session (capture_session_id, start_sec),
  KEY idx_transcript_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_analyses (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  stage VARCHAR(80) NULL,
  error_message TEXT NULL,
  transcription_model VARCHAR(80) NULL,
  metrics JSON NULL,
  interactions JSON NULL,
  insights JSON NULL,
  insights_generated_at TIMESTAMP(3) NULL,
  scenes JSON NULL,
  scenes_generated_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_capture_analyses_session (capture_session_id),
  KEY idx_capture_analyses_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_scene_annotations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  scene_index INT NOT NULL DEFAULT 0,
  scene_title VARCHAR(300) NULL,
  start_sec DECIMAL(12,3) NOT NULL DEFAULT 0,
  end_sec DECIMAL(12,3) NOT NULL DEFAULT 0,
  note MEDIUMTEXT NOT NULL,
  tags JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_scene_annotations_session (capture_session_id, scene_index),
  KEY idx_scene_annotations_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_hypothesis_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  hypothesis_index INT NOT NULL DEFAULT 0,
  hypothesis_text MEDIUMTEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  adjusted_text MEDIUMTEXT NULL,
  confidence VARCHAR(40) NOT NULL DEFAULT 'media',
  comment MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_hyp_reviews_session (capture_session_id, hypothesis_index),
  KEY idx_hyp_reviews_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_hypothesis_review_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  review_id CHAR(36) NOT NULL,
  capture_session_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  hypothesis_index INT NOT NULL DEFAULT 0,
  action VARCHAR(40) NOT NULL,
  status VARCHAR(40) NOT NULL,
  adjusted_text MEDIUMTEXT NULL,
  confidence VARCHAR(40) NOT NULL DEFAULT 'media',
  comment MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_hyp_events_review (review_id, created_at),
  KEY idx_hyp_events_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_consents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  participant_id CHAR(36) NULL,
  owner_id CHAR(36) NOT NULL,
  scope VARCHAR(60) NOT NULL,
  granted TINYINT(1) NOT NULL DEFAULT 0,
  consent_text MEDIUMTEXT NULL,
  granted_at TIMESTAMP(3) NULL,
  consent_version VARCHAR(40) NOT NULL DEFAULT '1',
  user_id CHAR(36) NULL,
  user_agent VARCHAR(500) NULL,
  recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  source VARCHAR(40) NOT NULL DEFAULT 'app',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_capture_consents_session (capture_session_id),
  KEY idx_capture_consents_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_invitations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  capture_session_id CHAR(36) NOT NULL,
  participant_id CHAR(36) NULL,
  owner_id CHAR(36) NOT NULL,
  token VARCHAR(80) NOT NULL,
  note TEXT NULL,
  expires_at TIMESTAMP(3) NULL,
  max_uses INT NULL,
  uses_count INT NOT NULL DEFAULT 0,
  revoked_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_capture_invitations_token (token),
  KEY idx_capture_invitations_session (capture_session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS capture_preferences (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  area_key VARCHAR(80) NULL,
  mode VARCHAR(40) NOT NULL DEFAULT 'individual',
  capture_mode VARCHAR(40) NOT NULL DEFAULT 'camera',
  record_screen TINYINT(1) NOT NULL DEFAULT 0,
  retention_days INT NOT NULL DEFAULT 30,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_billing (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  subscription_status VARCHAR(40) NULL,
  current_period_start TIMESTAMP(3) NULL,
  current_period_end TIMESTAMP(3) NULL,
  included_used_cents DECIMAL(14,4) NOT NULL DEFAULT 0,
  extra_pending_cents DECIMAL(14,4) NOT NULL DEFAULT 0,
  redsys_card_token VARCHAR(120) NULL,
  redsys_card_brand VARCHAR(40) NULL,
  redsys_card_expiry VARCHAR(20) NULL,
  redsys_original_auth_code VARCHAR(40) NULL,
  redsys_original_order VARCHAR(40) NULL,
  next_charge_at TIMESTAMP(3) NULL,
  donation_to_credits TINYINT(1) NOT NULL DEFAULT 1,
  credit_balance_cents DECIMAL(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_user_billing_next_charge (subscription_status, next_charge_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redsys_payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  order_code VARCHAR(40) NOT NULL,
  amount_cents INT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  kind VARCHAR(40) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  response_code VARCHAR(20) NULL,
  auth_code VARCHAR(40) NULL,
  card_token VARCHAR(120) NULL,
  card_brand VARCHAR(40) NULL,
  card_expiry VARCHAR(20) NULL,
  raw_response JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_redsys_order (order_code),
  KEY idx_redsys_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pricing_config (
  id TINYINT(1) NOT NULL PRIMARY KEY DEFAULT 1,
  openai_input_per_1k DECIMAL(14,6) NOT NULL DEFAULT 0,
  openai_output_per_1k DECIMAL(14,6) NOT NULL DEFAULT 0,
  gemini_input_per_1k DECIMAL(14,6) NOT NULL DEFAULT 0,
  gemini_output_per_1k DECIMAL(14,6) NOT NULL DEFAULT 0,
  replicate_video_per_second DECIMAL(14,6) NOT NULL DEFAULT 0,
  replicate_lipsync_per_second DECIMAL(14,6) NOT NULL DEFAULT 0,
  replicate_image_per_unit DECIMAL(14,6) NOT NULL DEFAULT 0,
  elevenlabs_per_1k_chars DECIMAL(14,6) NOT NULL DEFAULT 0,
  margin_user_pays_pct DECIMAL(8,3) NOT NULL DEFAULT 0,
  margin_platform_pays_pct DECIMAL(8,3) NOT NULL DEFAULT 0,
  subscription_price_cents INT NOT NULL DEFAULT 0,
  subscription_included_cents INT NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  vat_pct DECIMAL(8,3) NOT NULL DEFAULT 21,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Archivos: índice de los ficheros guardados en disco por la API.
CREATE TABLE IF NOT EXISTS stored_files (
  id CHAR(36) NOT NULL PRIMARY KEY,
  bucket VARCHAR(60) NOT NULL,
  path VARCHAR(600) NOT NULL,
  owner_id CHAR(36) NULL,
  mime_type VARCHAR(160) NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_stored_files (bucket, path(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Cuentas propias (fase A: la identidad pasa a este servidor)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  full_name VARCHAR(200) NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  disabled TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_app_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_user_roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(40) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_app_user_role (user_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  refresh_hash CHAR(64) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip VARCHAR(60) NULL,
  revoked_at TIMESTAMP(3) NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_app_sessions_hash (refresh_hash),
  KEY idx_app_sessions_user (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_auth_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  used_at TIMESTAMP(3) NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_app_auth_tokens_hash (token_hash),
  KEY idx_app_auth_tokens_user (user_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_login_attempts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(60) NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_app_login_attempts (email, ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Fase 4: ajustes por usuario (claves de IA y correo)
CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  openai_key TEXT NULL,
  gemini_key TEXT NULL,
  replicate_key TEXT NULL,
  elevenlabs_key TEXT NULL,
  text_provider VARCHAR(20) NOT NULL DEFAULT 'gemini',
  preferred_model VARCHAR(120) NULL,
  turn_key_id TEXT NULL,
  turn_api_token TEXT NULL,
  turn_urls TEXT NULL,
  turn_username TEXT NULL,
  turn_credential TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_settings (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  from_name VARCHAR(255) NULL,
  from_email VARCHAR(255) NULL,
  reply_to VARCHAR(255) NULL,
  subject_template TEXT NULL,
  body_template MEDIUMTEXT NULL,
  logo_url TEXT NULL,
  auto_send_on_complete TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
