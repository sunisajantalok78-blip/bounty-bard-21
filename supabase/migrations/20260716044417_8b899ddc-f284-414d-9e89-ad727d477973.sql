
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads' AND column_name='updated_at') THEN
    ALTER TABLE public.leads ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_leads_user_status_created
  ON public.leads(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_created
  ON public.leads(user_id, created_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('nightly-leads-maintenance');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'nightly-leads-maintenance',
  '15 3 * * *',
  $$ SELECT public.purge_stale_ignored_leads(); ANALYZE public.leads; $$
);
