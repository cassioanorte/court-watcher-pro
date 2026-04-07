
-- Schedule fetch-movements every 12 hours (pg_cron already enabled)
SELECT cron.schedule(
  'fetch-movements-cron',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/fetch-movements',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
