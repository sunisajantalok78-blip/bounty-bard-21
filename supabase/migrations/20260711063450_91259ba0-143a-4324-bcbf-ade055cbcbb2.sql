
-- 1. Leads: add owner column + tighten RLS
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "Authenticated read leads" ON public.leads;
DROP POLICY IF EXISTS "Public can insert leads via webhook" ON public.leads;

CREATE POLICY "Owners and admins read leads"
  ON public.leads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert own leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update own leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Marketing plans: add owner column + tighten RLS
ALTER TABLE public.marketing_plans ADD COLUMN IF NOT EXISTS user_id uuid;

DROP POLICY IF EXISTS "Public can insert marketing plans" ON public.marketing_plans;

CREATE POLICY "Owners insert own marketing plans"
  ON public.marketing_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners read own marketing plans"
  ON public.marketing_plans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners update own marketing plans"
  ON public.marketing_plans FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins delete marketing plans"
  ON public.marketing_plans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_validation_status ON public.leads(validation_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_plans_user_id ON public.marketing_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_my_portfolio_user_id ON public.my_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_scraper_config_user_id ON public.scraper_config(user_id);
