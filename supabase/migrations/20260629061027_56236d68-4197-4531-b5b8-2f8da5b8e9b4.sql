
DROP POLICY IF EXISTS "Authenticated full access" ON public.leads;
DROP POLICY IF EXISTS "Public read/write plans" ON public.marketing_plans;

CREATE POLICY "Public can read marketing plans" ON public.marketing_plans FOR SELECT TO anon USING (true);
CREATE POLICY "Public can insert marketing plans" ON public.marketing_plans FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated read leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update leads" ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
