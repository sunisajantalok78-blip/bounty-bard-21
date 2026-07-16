# Governance — Anti-Spam & Rate Limits

All limits enforced server-side. Do not rely on client checks.

| Rule                          | Value       | Enforced in                                      |
|-------------------------------|-------------|--------------------------------------------------|
| Daily AI proposals per user   | **30 / day**| `assertWithinDailyLimit()` — `dashboard.functions.ts` |
| Anti-bulk click cooldown      | **10 s**    | `src/lib/pitch-governance.ts` (`checkCooldown`)  |
| Lead ID deduplication         | on `(user_id, contact)` | UNIQUE index on `leads`                  |
| Auto-purge rejected leads     | **> 7 days**| `purge_stale_ignored_leads()` via pg_cron        |
| Body size on public API       | **32 KB**   | `/api/public/incoming-lead` handler              |
| Scraper max leads per run     | user-set    | `scraper_config.max_leads_per_run`               |

## Daily cap accounting

Every successful `requestProposalFn` call increments a counter keyed by
`(user_id, day)`. A failed call does **not** count against the cap.
Admins can inspect current usage in the *Admin* room.

## Failure modes

- **`LIMIT_EXCEEDED`** — user has hit 30/day. UI surfaces this as a toast
  with the reset time (00:00 UTC).
- **`COOLDOWN`** — user clicked *Generate* twice within 10s. UI disables
  the button for the remainder of the window.
- **Signature mismatch on `/incoming-lead`** — request rejected with 401,
  logged (without body) to `n8n_events`.

## Nightly maintenance

`pg_cron` runs `nightly-leads-maintenance` at 03:15 UTC:

1. `purge_stale_ignored_leads()` — deletes leads older than 7 days with
   `status IN ('ignored','invalid')` or `validation_status = 'invalid'`.
2. `ANALYZE public.leads` — refresh planner stats after purge.
