
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'webhook',
  title TEXT NOT NULL,
  budget NUMERIC,
  urgency TEXT NOT NULL DEFAULT 'Medium',
  description TEXT,
  contact TEXT,
  raw JSONB,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert leads via webhook" ON public.leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public can read leads (dashboard)" ON public.leads FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated full access" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.marketing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals TEXT,
  plan JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketing_plans TO anon;
GRANT ALL ON public.marketing_plans TO service_role;
ALTER TABLE public.marketing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write plans" ON public.marketing_plans FOR ALL TO anon USING (true) WITH CHECK (true);
