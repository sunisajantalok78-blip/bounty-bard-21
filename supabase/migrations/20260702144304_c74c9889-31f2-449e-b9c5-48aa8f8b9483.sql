
-- Remove public anon read on leads
DROP POLICY IF EXISTS "Public can read leads (dashboard)" ON public.leads;
-- Remove overly permissive authenticated update
DROP POLICY IF EXISTS "Authenticated update leads" ON public.leads;
REVOKE SELECT ON public.leads FROM anon;

-- Remove public anon read on marketing_plans
DROP POLICY IF EXISTS "Public can read marketing plans" ON public.marketing_plans;
REVOKE SELECT ON public.marketing_plans FROM anon;
