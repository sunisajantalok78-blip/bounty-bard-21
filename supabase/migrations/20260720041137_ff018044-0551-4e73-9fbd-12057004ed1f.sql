
-- 1. Let a signed-in user always read their own membership rows.
--    This lets is_org_member / is_org_admin work as SECURITY INVOKER.
DROP POLICY IF EXISTS "orgmem_select_self" ON public.organization_members;
CREATE POLICY "orgmem_select_self" ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Switch helpers to SECURITY INVOKER (they only inspect the caller's own rows).
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user AND role = 'admin')
$$;

-- 3. Lock down the trigger helper — it must never be callable via the API.
REVOKE EXECUTE ON FUNCTION public.add_owner_as_admin() FROM PUBLIC, anon, authenticated;
