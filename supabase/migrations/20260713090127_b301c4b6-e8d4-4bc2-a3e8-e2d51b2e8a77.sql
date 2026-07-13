
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous scheduling with the same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('redsys-charge-recurring');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'redsys-charge-recurring',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://iworkpre.lovable.app/api/public/redsys/charge-recurring',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jd3J0dWNpd3F0dHdiaXpxc3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTExOTMsImV4cCI6MjA5NzM4NzE5M30.kmr5ZXFjo4dHYhI5qBeBENChMbsaML6ZsTFNeXcPhuE'
    ),
    body := '{}'::jsonb
  );
  $$
);
