-- ============================================================
-- Migration: Schedule process-challenge daily cron
-- ============================================================
-- Settles active challenges every day at 00:05 UTC by hitting the
-- process-challenge edge function. The function recomputes
-- completed/failed days from daily_proofs and finalizes any
-- challenges whose end_date has passed (returning the principal
-- minus the manual no-proof penalty on success, or burning the
-- stake on failure).
--
-- HOW THIS WORKS
-- --------------
-- pg_cron schedules a SQL job inside the database. The job uses
-- pg_net to make an HTTP POST to the edge function. Both extensions
-- are pre-installed on Supabase managed projects.
--
-- The service role key is read from Vault, NOT hardcoded. After
-- this migration is applied for the first time, run ONCE in the
-- Supabase SQL editor:
--
--   SELECT vault.create_secret(
--     '<your-service-role-key-from-project-settings>',
--     'process_challenge_service_key'
--   );
--
-- The cron job will start working as soon as that secret exists.
-- If you ever rotate the key, update it with:
--
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'process_challenge_service_key'),
--     '<new-key>'
--   );
--
-- WHY 00:05 UTC
-- -------------
-- Challenges store dates as plain DATE without timezone. Running a
-- few minutes after midnight UTC ensures "today" has rolled over
-- everywhere the function compares dates. Users in negative
-- timezones may see settlement land slightly into their previous
-- evening, which is acceptable for daily settlement.
--
-- IDEMPOTENCY
-- -----------
-- This migration unschedules any existing job with the same name
-- before scheduling, so re-applying is safe. The edge function
-- itself is also idempotent — re-running on the same day for the
-- same challenge will not double-pay or double-burn.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any prior schedule with the same name so the migration is
-- re-runnable. cron.unschedule throws if the job doesn't exist, so
-- we wrap it.
DO $$
BEGIN
  PERFORM cron.unschedule('process-challenge-daily');
EXCEPTION
  WHEN OTHERS THEN
    -- Job didn't exist; nothing to clean up.
    NULL;
END $$;

-- Schedule the daily job. The URL is hardcoded to this project's
-- functions endpoint (project_id is already in supabase/config.toml,
-- so this isn't a new disclosure). The bearer token is fetched at
-- run time from Vault to avoid leaking it into pg_dump.
SELECT cron.schedule(
  'process-challenge-daily',
  '5 0 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://tclazlzlfkajyqbakoub.supabase.co/functions/v1/process-challenge',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'process_challenge_service_key'
        LIMIT 1
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
