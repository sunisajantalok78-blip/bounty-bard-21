# Security policy

## Reporting a vulnerability

Email `sunisajantalok78@gmail.com` with:
- A concise description
- Steps to reproduce
- The impact you observed

Please do **not** open public issues for security reports.

## Public endpoints

Everything under `/api/public/*` is reachable without a signed-in Supabase
session. Each handler must:

1. Verify the `x-webhook-secret` header (`INCOMING_LEAD_SECRET`) with a
   constant-time comparison (`safeEqual` in `src/lib/http.server.ts`).
2. Cap request body size (`readBoundedText`).
3. Validate every field with Zod (`src/lib/schemas.ts`).
4. Never return raw database error messages to callers — log server-side
   via `logError` and return a generic code.

## Row-level security

All user-scoped tables (`leads`, `marketing_plans`, `my_portfolio`,
`scraper_config`, `user_roles`) enable RLS with owner-scoped policies:
`user_id = auth.uid()` plus admin override via `has_role(auth.uid(),'admin')`.
Never widen a policy to `TO anon` unless the data is truly public.

## Secrets

- Runtime secrets live in Lovable Cloud → Secrets, read via `process.env`
  inside server handlers only. Never at module scope of shared files.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in verified webhooks and admin
  server functions after `has_role` check.
- Publishable keys (`VITE_*`) are safe to ship to the browser.
