
ALTER TABLE public.scraper_config
  ADD COLUMN IF NOT EXISTS intents text[] NOT NULL DEFAULT ARRAY['hiring','freelance']::text[],
  ADD COLUMN IF NOT EXISTS geo_target text NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS max_results_per_query integer NOT NULL DEFAULT 5;

ALTER TABLE public.scraper_config
  ADD CONSTRAINT scraper_config_max_results_range
  CHECK (max_results_per_query BETWEEN 1 AND 50);
