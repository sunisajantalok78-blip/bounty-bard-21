# Deploy

The app is hosted by Lovable. Publish from the editor's **Publish** button;
frontend goes live after ~60s, backend (server fns + migrations) is live the
moment they're saved.

## First-time setup

1. Enable Lovable Cloud (already on).
2. Set required secrets in Cloud → Secrets:
   - `INCOMING_LEAD_SECRET` (generate 64-char random)
   - `JINA_API_KEY`
   - `N8N_WEBHOOK_URL` (default, optional — users can override)
3. Run all migrations under `supabase/migrations/` (auto-applied by Lovable).
4. Confirm admin user is `sunisajantalok78@gmail.com` — sign in once so the
   `handle_new_user_role` trigger grants the `admin` role.

## Release checklist

Run this before every publish:

- [ ] `bun test` — all green
- [ ] `bunx tsgo` — 0 errors
- [ ] Supabase advisor — 0 errors, 0 high warnings
- [ ] Security scan (`security--run_security_scan`) — 0 critical
- [ ] Confirm no `console.log` of secrets in modified files
- [ ] Smoke sign-in → generate 1 proposal → row `updated_at` refreshes
- [ ] Signed `curl` to `/api/public/incoming-lead` returns 200
- [ ] Rotate `INCOMING_LEAD_SECRET` if last rotated > 90 days ago

## Rollback

1. Open Lovable → project history.
2. Restore the last known-good version.
3. If a migration is the culprit, write a compensating migration — do NOT
   edit or delete an already-applied migration file.

## Custom domain

Project Settings → Domains. Requires the site to be published first.

## Post-deploy verification

```bash
curl -fsS https://bounty-bard-21.lovable.app/ > /dev/null && echo "frontend ok"
curl -fsS -X POST https://bounty-bard-21.lovable.app/api/public/user-events \
  -H "content-type: application/json" \
  -d '{"event":"deploy.smoketest"}' -o /dev/null -w "user-events %{http_code}\n"
```
