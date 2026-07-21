
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS hubspot_webhook_url text,
  ADD COLUMN IF NOT EXISTS salesforce_webhook_url text,
  ADD COLUMN IF NOT EXISTS zero_data_retention boolean NOT NULL DEFAULT true;
