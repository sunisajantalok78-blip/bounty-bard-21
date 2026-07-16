# Production-Readiness Plan v2

The app is already hardened (RLS, webhook signing, secret scrubbing, tests). This pass closes the remaining gaps that matter before real traffic and ships a proper docs set to your GitHub repo.

## 1. Reliability & correctness

- Fix the 4 failing tests in `src/lib/pitch-governance.test.ts` (cooldown + daily-cap regressions from the last refactor). Green suite is a release gate.
- Add a `refundGeneration` fast path when `requestProposalFn` throws, so a failed AI call does not permanently burn the user's daily quota.
- Wrap `dispatchToN8n` with a 5s timeout + 1 retry; today a hung n8n instance blocks the request until Cloudflare kills it.
- Add `Sentry`-style capture only in `logError` (no new dep — reuse existing `error-capture.ts`) and surface a `request_id` in every public-route JSON error.

## 2. Data & schema

- Migration: add `leads.updated_at` trigger (already on some tables, missing on `leads` after column changes), and a `leads(user_id, status, created_at desc)` composite index for the dashboard's main list query.
- Migration: add `check` constraints for `leads.status`, `leads.urgency`, `leads.validation_status` enums so bad values from n8n get rejected at write time, not silently stored.
- Nightly `pg_cron` job to `VACUUM ANALYZE` `leads` + call `purge_stale_ignored_leads()`.

## 3. Rate limiting & abuse

- Replace the in-memory per-IP limiter on `/api/public/*` with a Supabase-backed sliding window (`rate_limits` table + `check_and_increment` SQL function). Workers are stateless — the current in-memory limiter resets on every cold start.
- Cap `raw` JSON to 32 KB (already) AND cap array/object depth to prevent parser DoS.

## 4. Observability

- New admin sub-tab "System Health" showing: last 50 `n8n_events` with status, failed pitch generations today, per-endpoint request counts (from a new `request_log` view), and Supabase advisor warnings.
- Structured JSON logs from every server fn (`scope`, `userId`, `latency_ms`, `ok`).

## 5. UX polish (small, high-impact)

- Optimistic status/tag updates on the dashboard (current mutations wait for round-trip).
- Keyboard shortcuts: `j/k` to move selection, `g` to generate proposal, `/` to focus search.
- Empty-state CTA on the leads panel that links to the Scraper tab when 0 leads exist.

## 6. GitHub documentation set

Create/refresh in the repo root and `/docs`:

```text
README.md              # rewritten: what it is, live URL, 60-sec quickstart, screenshots
SECURITY.md            # keep, add "supported versions" + PGP-less report flow
CONTRIBUTING.md        # local dev, branch strategy, commit style, test/lint gates
LICENSE                # MIT (confirm with you)
docs/
  ARCHITECTURE.md      # diagram: browser → TanStack serverFn → Supabase / Jina / n8n / Lovable AI
  DATA_MODEL.md        # every table, columns, RLS summary, ER diagram (mermaid)
  API.md               # /api/public/incoming-lead + /api/public/user-events contracts, headers, sample curl
  N8N.md               # required workflows, expected payloads, webhook URL config, "generate_proposal" action shape
  GOVERNANCE.md        # daily pitch cap, cooldown, dedup, 7-day purge — exact numbers + where enforced
  RUNBOOK.md           # common incidents: n8n down, Jina quota, AI gateway 429, Supabase paused — with fixes
  DEPLOY.md            # Lovable publish flow, required secrets, first-run checklist, rollback
```

All docs use mermaid where a diagram helps and link back to the exact source files.

## 7. Release checklist (added to `DEPLOY.md`)

1. `bun test` green.
2. `security--run_security_scan` — 0 critical, 0 high.
3. Supabase advisor — 0 errors.
4. Rotate `INCOMING_LEAD_SECRET` if not rotated in 90 days.
5. Confirm `APP_ORIGIN` matches the live domain.
6. Smoke: sign in → generate 1 proposal → verify n8n event row.
7. Publish via Lovable → verify `/api/public/incoming-lead` with signed curl.

---

## Execution order this turn

1. Fix `pitch-governance` tests + add refund path.
2. Migration: composite index + enum checks + `leads.updated_at` trigger.
3. Rate-limit table + SQL fn + wire into public routes.
4. Write all 8 doc files listed above.
5. Re-run tests + security scan; report deltas.

Nothing in the current theme, tabs, or auth flow changes. All work is backend hardening + docs.

Approve and I'll ship it in one batch.
