# Security Policy

## Supported versions

Only the currently deployed version at
https://bounty-bard-21.lovable.app receives security fixes.

## Reporting a vulnerability

Email **sunisajantalok78@gmail.com** with:

- A description of the issue
- Reproduction steps or a proof-of-concept
- The impact you believe it has

Please do not open a public GitHub issue for vulnerabilities. We aim to
acknowledge within 72 hours and patch high-severity issues within 7 days.

## Threat model

- **Auth:** Supabase Auth (email + password). Admin is granted by a DB
  trigger only for the hard-coded owner email.
- **Data isolation:** All user tables (`leads`, `my_portfolio`,
  `scraper_config`, `marketing_plans`, `user_roles`) enforce RLS scoped to
  `auth.uid()`.
- **Public endpoints (`/api/public/*`):**
  - `incoming-lead` — HMAC-SHA256 with `INCOMING_LEAD_SECRET`, timing-safe
    compare, body size cap.
  - `user-events` — best-effort observability sink, no PII.
- **AI Gateway:** Called server-side only; requests are per-user rate-capped
  (see [docs/GOVERNANCE.md](docs/GOVERNANCE.md)).
- **Secrets:** Never in client bundles. `SUPABASE_SERVICE_ROLE_KEY` and
  `INCOMING_LEAD_SECRET` are read only inside server-function handlers.
- **Logging:** `src/lib/log.server.ts` scrubs known secret patterns before
  emitting logs.

## What must never happen

- A signed-in user reading or mutating another user's `leads`, `my_portfolio`,
  or `scraper_config` rows.
- A public HTTP caller writing to `leads` without a valid HMAC signature.
- A service-role client (`supabaseAdmin`) being imported into any client bundle.
- Any AI or DNS work executing without first checking the caller's daily
  quota in `assertWithinDailyLimit`.
