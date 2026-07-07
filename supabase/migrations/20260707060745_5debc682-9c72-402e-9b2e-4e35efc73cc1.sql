REVOKE ALL ON FUNCTION public.purge_stale_ignored_leads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_stale_ignored_leads() FROM anon;
REVOKE ALL ON FUNCTION public.purge_stale_ignored_leads() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_stale_ignored_leads() TO service_role;