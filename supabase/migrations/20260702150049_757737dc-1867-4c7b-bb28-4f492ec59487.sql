
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS business_proposal text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS raw_social_data jsonb;
