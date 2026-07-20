
-- ==========================================================
-- Phase 1: Multi-tenant enterprise foundation
-- ==========================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.batch_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan         text NOT NULL DEFAULT 'free',
  ai_key_mode  text NOT NULL DEFAULT 'platform' CHECK (ai_key_mode IN ('platform','byok')),
  byok_openai_key    text,
  byok_anthropic_key text,
  credits_pool integer NOT NULL DEFAULT 1000,
  credits_used integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. organization_members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role               public.org_role NOT NULL DEFAULT 'member',
  credits_allocated  integer NOT NULL DEFAULT 0,
  credits_used       integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 4. Security-definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user AND role = 'admin')
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid,uuid) TO authenticated;

-- 5. organizations RLS
DROP POLICY IF EXISTS "org_select_members" ON public.organizations;
CREATE POLICY "org_select_members" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "org_insert_own" ON public.organizations;
CREATE POLICY "org_insert_own" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "org_update_admin" ON public.organizations;
CREATE POLICY "org_update_admin" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id, auth.uid()))
  WITH CHECK (public.is_org_admin(id, auth.uid()));

DROP POLICY IF EXISTS "org_delete_owner" ON public.organizations;
CREATE POLICY "org_delete_owner" ON public.organizations
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- 6. organization_members RLS
DROP POLICY IF EXISTS "orgmem_select_own_org" ON public.organization_members;
CREATE POLICY "orgmem_select_own_org" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "orgmem_insert_self_or_admin" ON public.organization_members;
CREATE POLICY "orgmem_insert_self_or_admin" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_org_admin(organization_id, auth.uid()));

DROP POLICY IF EXISTS "orgmem_update_admin" ON public.organization_members;
CREATE POLICY "orgmem_update_admin" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

DROP POLICY IF EXISTS "orgmem_delete_admin" ON public.organization_members;
CREATE POLICY "orgmem_delete_admin" ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR user_id = auth.uid());

-- 7. Auto-add owner as admin
CREATE OR REPLACE FUNCTION public.add_owner_as_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role, credits_allocated)
  VALUES (NEW.id, NEW.owner_id, 'admin', NEW.credits_pool)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_org_add_owner ON public.organizations;
CREATE TRIGGER trg_org_add_owner AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_admin();

-- 8. lead_batches
CREATE TABLE IF NOT EXISTS public.lead_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  filename        text NOT NULL,
  total           integer NOT NULL DEFAULT 0,
  processed       integer NOT NULL DEFAULT 0,
  failed          integer NOT NULL DEFAULT 0,
  status          public.batch_status NOT NULL DEFAULT 'queued',
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batches_org_created ON public.lead_batches(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_batches TO authenticated;
GRANT ALL ON public.lead_batches TO service_role;
ALTER TABLE public.lead_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batch_select_members" ON public.lead_batches;
CREATE POLICY "batch_select_members" ON public.lead_batches FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS "batch_insert_members" ON public.lead_batches;
CREATE POLICY "batch_insert_members" ON public.lead_batches FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND uploaded_by = auth.uid());
DROP POLICY IF EXISTS "batch_update_admin" ON public.lead_batches;
CREATE POLICY "batch_update_admin" ON public.lead_batches FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR uploaded_by = auth.uid());
DROP POLICY IF EXISTS "batch_delete_admin" ON public.lead_batches;
CREATE POLICY "batch_delete_admin" ON public.lead_batches FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- 9. Extend leads with org + batch
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_id        uuid REFERENCES public.lead_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS domain          text,
  ADD COLUMN IF NOT EXISTS company_name    text;

CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_batch      ON public.leads(batch_id);

-- Add org-scoped RLS (keep existing user_id policies working)
DROP POLICY IF EXISTS "leads_select_org" ON public.leads;
CREATE POLICY "leads_select_org" ON public.leads FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "leads_insert_org" ON public.leads;
CREATE POLICY "leads_insert_org" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "leads_update_org" ON public.leads;
CREATE POLICY "leads_update_org" ON public.leads FOR UPDATE TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "leads_delete_org" ON public.leads;
CREATE POLICY "leads_delete_org" ON public.leads FOR DELETE TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));

-- 10. credit_ledger
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delta           integer NOT NULL,
  reason          text NOT NULL,
  ref_id          uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_org_created ON public.credit_ledger(organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_select_members" ON public.credit_ledger;
CREATE POLICY "ledger_select_members" ON public.credit_ledger FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
DROP POLICY IF EXISTS "ledger_insert_members" ON public.credit_ledger;
CREATE POLICY "ledger_insert_members" ON public.credit_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- 11. invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            public.org_role NOT NULL DEFAULT 'member',
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_select_admin_or_email" ON public.invitations;
CREATE POLICY "inv_select_admin_or_email" ON public.invitations FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())
      OR lower(email) = lower((auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "inv_insert_admin" ON public.invitations;
CREATE POLICY "inv_insert_admin" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

DROP POLICY IF EXISTS "inv_update_admin_or_invitee" ON public.invitations;
CREATE POLICY "inv_update_admin_or_invitee" ON public.invitations FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid())
      OR lower(email) = lower((auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "inv_delete_admin" ON public.invitations;
CREATE POLICY "inv_delete_admin" ON public.invitations FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

-- 12. updated_at triggers
DROP TRIGGER IF EXISTS trg_orgs_updated_at ON public.organizations;
CREATE TRIGGER trg_orgs_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_batches_updated_at ON public.lead_batches;
CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON public.lead_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. Realtime for batches + leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_batches;
-- leads may already be in the publication; ignore duplicate errors
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
