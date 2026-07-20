# Enterprise SaaS Upgrade Plan

This is a large multi-week re-architecture. I'll deliver it in **4 sequenced phases** so each phase is shippable and testable. Please confirm the plan (and phase 1 scope) before I start — this will consume significant credits.

---

## Phase 1 — Multi-tenant foundation + Bulk ingestion (biggest impact)

**Database (new migration):**
- `organizations` (id, name, plan, owner_id, ai_key_mode: platform|byok, encrypted_openai_key, encrypted_anthropic_key, credits_pool)
- `organization_members` (org_id, user_id, role: admin|member, credits_allocated, credits_used)
- `invitations` (org_id, email, role, token, expires_at)
- `lead_batches` (id, org_id, uploaded_by, filename, total, processed, failed, status)
- Add `organization_id` + `batch_id` to `leads`; rewrite RLS to org-scoped via `has_org_role()` security-definer function
- `credit_ledger` (org_id, user_id, delta, reason, ref_id)

**Backend server functions:**
- `createOrganizationFn`, `inviteMemberFn`, `acceptInviteFn`, `updateMemberRoleFn`, `allocateCreditsFn`
- `uploadBatchFn` — parses CSV/XLSX (papaparse + xlsx), validates rows, inserts batch + queued leads
- `processBatchTickFn` — pulls next N pending leads, runs scrape → validate → AI proposal, decrements credits, updates status
- Cron (pg_cron → `/api/public/hooks/process-queue`) every minute to drain queues
- Realtime channel on `leads` + `lead_batches` for live progress

**Frontend:**
- Route `_authenticated/onboarding` — create org / accept invite
- Route `_authenticated/bulk-upload` — react-dropzone CSV/XLSX (max 1000 rows), preview, submit
- Route `_authenticated/batches/$id` — live progress bar, per-lead status table (Pending / Scraping / Analyzing / Completed / Failed)

## Phase 2 — Team workspace + Credit control

- Route `_authenticated/team` (admin): member list, roles, credit allocation sliders, pending invites
- Route `_authenticated/settings/api-keys` (admin): BYOK toggle, paste OpenAI/Anthropic keys (encrypted at rest via pgsodium), zero-data-retention badge
- Shared **Team Library** (`_authenticated/library`): all org leads with filters (owner, batch, status, tags, date), full-text search, saved views
- Credit guard in every AI server function: check member allocation before spend, log to ledger

## Phase 3 — Export + CRM hooks

- Bulk export selected/filtered leads → CSV or XLSX (Instantly/Lemlist column mapping presets)
- Server routes: `/api/public/webhooks/hubspot-export`, `/api/public/webhooks/salesforce-export` (stubbed, admin-configurable webhook URL)
- Per-lead "Send to CRM" button

## Phase 4 — Premium UI refactor

- FinTech dark theme pass: new tokens in `styles.css`, refined shadcn variants
- Top metrics bar: Total Leads Scanned / Successful Matches / Credits Remaining / Active Campaigns (org-scoped)
- Proposal preview modal (Dialog) with edit-in-place, copy, export single, send-to-CRM actions
- Data-privacy indicators (encryption + ZDR badges) throughout

---

## Technical stack additions
- `papaparse`, `xlsx` (CSV/XLSX parsing on server functions)
- `react-dropzone` (upload UI)
- `pgsodium` extension (encrypt BYOK keys) — falls back to app-layer AES-GCM if unavailable
- Supabase Realtime (already configured) for live batch progress

## Migration risk
- Existing `leads` rows will be back-filled with a default "personal" org per user so nothing is lost.
- All existing RLS policies get rewritten org-scoped in one migration.

---

## Confirm to proceed
- **Green-light Phase 1** and I start with the DB migration + bulk upload flow (largest single credit chunk).
- Or tell me to reorder / drop phases.