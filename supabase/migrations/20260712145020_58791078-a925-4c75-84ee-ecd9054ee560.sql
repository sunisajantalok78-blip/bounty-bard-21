-- has_role: switch to SECURITY INVOKER. It always checks the caller's own
-- roles (has_role(auth.uid(), ...)), which the "read own roles" SELECT
-- policy on user_roles already permits, so RLS keeps working.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

-- Trigger function: must remain SECURITY DEFINER (writes to user_roles on
-- new auth.users), but should never be callable directly via the API.
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- Admin/cron cleanup: must remain SECURITY DEFINER (deletes across owners),
-- but should not be callable by API roles.
REVOKE ALL ON FUNCTION public.purge_stale_ignored_leads() FROM PUBLIC, anon, authenticated;