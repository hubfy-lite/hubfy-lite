-- Enable pg_cron and pg_net extensions (required for scheduled HTTP calls)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule orphan asset cleanup every 6 hours
-- Uses supabase_url() and service_role_key from Vault.
-- IMPORTANT: before running this migration, add these secrets in the Supabase Dashboard:
--   Dashboard > Settings > Vault > New Secret:
--     name: supabase_url        value: https://<project-ref>.supabase.co
--     name: service_role_key    value: <your service_role_key>
SELECT cron.schedule(
  'cleanup-orphan-assets',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
           || '/functions/v1/asset-cleanup-orphans',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
