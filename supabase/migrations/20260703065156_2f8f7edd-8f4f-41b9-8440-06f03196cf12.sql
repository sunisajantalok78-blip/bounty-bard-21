CREATE TABLE IF NOT EXISTS public.scraper_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  sources JSONB NOT NULL DEFAULT '{"facebook": true, "instagram": true, "google": true, "linkedin": false}'::jsonb,
  keywords TEXT[] NOT NULL DEFAULT ARRAY['marketing','CRM setup','Swedish language']::text[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scraper_config TO authenticated;
GRANT ALL ON public.scraper_config TO service_role;

ALTER TABLE public.scraper_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read scraper_config" ON public.scraper_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update scraper_config" ON public.scraper_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated insert scraper_config" ON public.scraper_config FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.scraper_config (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;
