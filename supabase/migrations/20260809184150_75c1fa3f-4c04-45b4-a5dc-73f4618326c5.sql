-- 1) Practice areas
CREATE TABLE public.practice_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX practice_areas_default_key_idx ON public.practice_areas (key) WHERE user_id IS NULL;
CREATE UNIQUE INDEX practice_areas_user_key_idx ON public.practice_areas (user_id, key) WHERE user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_areas TO authenticated;
GRANT ALL ON public.practice_areas TO service_role;
ALTER TABLE public.practice_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_areas_select" ON public.practice_areas
  FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "practice_areas_insert_own" ON public.practice_areas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_default = false);
CREATE POLICY "practice_areas_update_own" ON public.practice_areas
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "practice_areas_delete_own" ON public.practice_areas
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_practice_areas_updated BEFORE UPDATE ON public.practice_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.practice_areas (user_id, key, label, is_default) VALUES
  (NULL, 'entrevistas', 'Entrevistas', true),
  (NULL, 'formacion', 'Formación', true),
  (NULL, 'negociacion', 'Negociación', true),
  (NULL, 'mediacion', 'Mediación', true),
  (NULL, 'terapia_grupal', 'Terapia grupal', true),
  (NULL, 'dinamicas_equipo', 'Dinámicas de equipo', true),
  (NULL, 'investigacion', 'Investigación', true),
  (NULL, 'educacion', 'Educación', true),
  (NULL, 'deportes', 'Deportes', true),
  (NULL, 'seleccion_personal', 'Selección de personal', true),
  (NULL, 'formacion_corporativa', 'Formación corporativa', true),
  (NULL, 'negociacion_comercial', 'Negociación comercial', true),
  (NULL, 'atencion_cliente', 'Atención al cliente', true),
  (NULL, 'liderazgo', 'Liderazgo y gestión de equipos', true),
  (NULL, 'simulaciones_medicas', 'Simulaciones médicas', true),
  (NULL, 'seguridad_emergencias', 'Fuerzas de seguridad y emergencias', true),
  (NULL, 'oposiciones', 'Preparación de oposiciones', true),
  (NULL, 'resolucion_conflictos', 'Mediación y resolución de conflictos', true),
  (NULL, 'competencias_docentes', 'Evaluación de competencias docentes', true),
  (NULL, 'ventas', 'Entrenamiento de ventas', true),
  (NULL, 'idiomas', 'Idiomas mediante conversaciones inmersivas', true),
  (NULL, 'protocolos_seguridad', 'Evaluación de protocolos de seguridad', true),
  (NULL, 'fabricacion_logistica', 'Fabricación, logística y mantenimiento', true);

-- 2) Simulations: area
ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS area_key text;

-- 3) Capture sessions
CREATE TABLE public.capture_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_id uuid REFERENCES public.simulations(id) ON DELETE SET NULL,
  game_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  area_key text,
  mode text NOT NULL DEFAULT 'individual',
  capture_mode text NOT NULL DEFAULT 'single_device',
  record_screen boolean NOT NULL DEFAULT false,
  consent_recording boolean NOT NULL DEFAULT false,
  consent_face_analysis boolean NOT NULL DEFAULT false,
  consent_text text,
  status text NOT NULL DEFAULT 'draft',
  retention_days integer NOT NULL DEFAULT 30,
  delete_after timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_sessions TO authenticated;
GRANT ALL ON public.capture_sessions TO service_role;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capture_sessions_owner_all" ON public.capture_sessions
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_capture_sessions_updated BEFORE UPDATE ON public.capture_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX capture_sessions_owner_idx ON public.capture_sessions (owner_id, created_at DESC);

-- 4) Participants
CREATE TABLE public.capture_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  identifier text,
  role text NOT NULL DEFAULT 'participante',
  photo_path text,
  color text,
  joined_at_sec numeric,
  is_late boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_participants TO authenticated;
GRANT ALL ON public.capture_participants TO service_role;
ALTER TABLE public.capture_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capture_participants_owner_all" ON public.capture_participants
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_capture_participants_updated BEFORE UPDATE ON public.capture_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX capture_participants_session_idx ON public.capture_participants (capture_session_id);

-- 5) Recordings
CREATE TABLE public.capture_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.capture_participants(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'camera',
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  duration_sec numeric,
  sync_offset_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploaded',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_recordings TO authenticated;
GRANT ALL ON public.capture_recordings TO service_role;
ALTER TABLE public.capture_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capture_recordings_owner_all" ON public.capture_recordings
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_capture_recordings_updated BEFORE UPDATE ON public.capture_recordings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX capture_recordings_session_idx ON public.capture_recordings (capture_session_id);

-- 6) Consents
CREATE TABLE public.capture_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_session_id uuid NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.capture_participants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'recording',
  granted boolean NOT NULL DEFAULT false,
  consent_text text,
  granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_consents TO authenticated;
GRANT ALL ON public.capture_consents TO service_role;
ALTER TABLE public.capture_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capture_consents_owner_all" ON public.capture_consents
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX capture_consents_session_idx ON public.capture_consents (capture_session_id);