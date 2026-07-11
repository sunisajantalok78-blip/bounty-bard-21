
# Production-Hardening Plan

A focused review of the Bounty Hunter dashboard with concrete fixes. I'll implement in the order below; each item is small and independently shippable.

## 1. Security (highest priority)

**Findings**
- `src/routes/api/public/incoming-lead.ts` is an unauthenticated public POST that writes directly to `leads` via `supabaseAdmin` (RLS bypass). Anyone on the internet can flood the table.
- Same route accepts arbitrary `raw: body` JSON with no size cap → storage abuse vector.
- `src/routes/api/public/user-events.ts` forwards any client-supplied `email` + `event` to n8n with no auth, no rate limit, no validation — open relay.
- `leads` RLS: `Authenticated read leads` uses `using: true` → any signed-in user reads every lead in the system (multi-tenant leak). Also `anon INSERT check: true` with no throttling.
- `marketing_plans` allows `anon INSERT` with `check: true` — anyone can spam rows; no owner column.
- `.env` in repo contains project URL + publishable key. Publishable is safe, but `.env` should still be `.gitignore`d to prevent later secret leakage.
- Missing shared-secret header on `/api/public/incoming-lead` and `/api/public/user-events` (webhook signing).

**Fixes**
- Add `INCOMING_LEAD_SECRET` (generated) and require `x-webhook-secret` header on both public routes; timing-safe compare.
- Add per-IP in-memory + DB rate limit (10 req/min) on both public routes.
- Cap request body at 32 KB; reject larger.
- Migration: tighten `leads` RLS — add `user_id uuid` (nullable for legacy), rewrite SELECT policy to `user_id = auth.uid() OR has_role(auth.uid(),'admin')`; remove blanket anon INSERT (route uses service role anyway, so drop the anon policy).
- Migration: add `user_id` to `marketing_plans`, replace anon INSERT with authenticated-owner INSERT + owner SELECT.
- Add `.env` and `.env*.local` to `.gitignore` (keep `.env.example`).

## 2. Code Quality

- Extract shared CORS + JSON response helpers (`src/lib/http.server.ts`) — currently duplicated in every public route.
- Extract shared Zod schemas for `Lead`, `Urgency`, etc. into `src/lib/schemas.ts` for reuse client + server.
- `dispatchToN8n` swallows the actual URL/status pair silently on Supabase log failures — return typed result already, but caller sites ignore `.ok`. Add a small `logN8nResult` helper and use it consistently.
- Remove hardcoded fallback origin in `tryEmail` (line 36 of `incoming-lead.ts`) — replace with required env `APP_ORIGIN`, warn if missing.

## 3. Performance

- `getAdminStatsFn` fires 7 sequential-ish `count` queries; already `Promise.all` — good. But `auth.admin.listUsers({ perPage: 1000 })` is expensive; replace user count with a Postgres RPC `count(*) from auth.users`.
- Add DB indexes: `leads(status)`, `leads(validation_status)`, `leads(created_at desc)`, `my_portfolio(user_id)`, `scraper_config(user_id)`.
- Add `staleTime` defaults to TanStack Query (currently everything refetches on focus).

## 4. Error Handling & Logging

- Central `logError(scope, err, meta?)` helper that strips known secret keys (`authorization`, `apikey`, `token`, `password`) before console output.
- Public routes currently return raw `error.message` from Postgres — replace with generic `"db_error"` and log detail server-side only.
- `incoming-lead` swallows email + n8n failures silently; surface as structured fields in response (already partially) and log via new helper.

## 5. Configuration & Environment

- Add `.env.example` with all required vars documented (VITE_*, SUPABASE_URL, N8N_WEBHOOK_URL, JINA_API_KEY, LOVABLE_API_KEY, INCOMING_LEAD_SECRET, APP_ORIGIN).
- Verify `.gitignore` covers `.env`, `.env.local`, `.output/`, `.vinxi/`, `dist/`.
- Document required Lovable Cloud secrets in `readme.dm` → rename to `README.md`.

## 6. Testing

- Add `vitest` (already available via `lovable-exec test`). Seed with:
  - `src/lib/schemas.test.ts` — Lead payload validation edge cases.
  - `src/lib/pitch-governance.test.ts` — daily cap + cooldown logic.
  - `src/lib/http.server.test.ts` — CORS + auth header check.
- Add a smoke test: `POST /api/public/incoming-lead` without secret → 401; with secret + invalid body → 400; with valid → 200.

## 7. Documentation

- Replace `readme.dm` (typo) with `README.md`:
  - What the app does
  - Local dev (`bun install`, `bun dev`)
  - Required secrets (list from `.env.example`)
  - Public webhook contracts (`/api/public/incoming-lead` schema)
  - n8n integration overview
  - Admin bootstrapping (email hardcoded in `handle_new_user_role`)
- Add short `SECURITY.md` describing responsible disclosure + which routes are public.
- Add JSDoc to `dispatchToN8n`, `requireSupabaseAuth`, `assertWithinDailyLimit`.

---

## Execution Order (what I'll actually change this turn)

1. Migration: tighten `leads` + `marketing_plans` RLS, add indexes, add `user_id` columns.
2. New `src/lib/http.server.ts` (CORS, auth-header check, JSON helper, body-size guard).
3. Refactor `incoming-lead.ts` + `user-events.ts` to use shared helpers, require `x-webhook-secret`, validate size, sanitize errors.
4. Generate `INCOMING_LEAD_SECRET` via `generate_secret`.
5. `src/lib/log.server.ts` with secret-scrubbing logger; wire into public routes and `n8n.server.ts`.
6. Add `.env.example`, update `.gitignore`, rename `readme.dm` → `README.md` with real content.
7. Add `SECURITY.md`.
8. Add three vitest files above.

Nothing in the UI/theme changes. All work is backend + config + docs.

Approve and I'll implement it in one batch.
