
-- 1. Extend leads with pitch + status if not already present
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_pitch text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- 2. Portfolio table
CREATE TABLE IF NOT EXISTS public.my_portfolio (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category   text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_portfolio TO authenticated;
GRANT ALL ON public.my_portfolio TO service_role;

ALTER TABLE public.my_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read portfolio" ON public.my_portfolio;
CREATE POLICY "Authenticated read portfolio" ON public.my_portfolio
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert portfolio" ON public.my_portfolio;
CREATE POLICY "Authenticated insert portfolio" ON public.my_portfolio
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update portfolio" ON public.my_portfolio;
CREATE POLICY "Authenticated update portfolio" ON public.my_portfolio
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete portfolio" ON public.my_portfolio;
CREATE POLICY "Authenticated delete portfolio" ON public.my_portfolio
  FOR DELETE TO authenticated USING (true);
