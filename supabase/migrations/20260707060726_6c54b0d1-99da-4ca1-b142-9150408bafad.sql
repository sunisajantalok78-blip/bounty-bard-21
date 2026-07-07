-- Anti-spam governance: purge stale ignored/invalid leads after 7 days.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_stale_ignored_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.leads
    WHERE (status IN ('ignored','invalid') OR validation_status = 'invalid')
      AND created_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- Unschedule any previous version, then re-register (daily at 03:15 UTC).
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'purge-stale-ignored-leads';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-stale-ignored-leads',
  '15 3 * * *',
  $$SELECT public.purge_stale_ignored_leads();$$
);