# Runbook

Common incidents and fixes. Keep this list boring and correct.

## 1. AI proposals return `LIMIT_EXCEEDED`

**Cause:** user hit the 30/day cap.
**Fix:** wait until 00:00 UTC, or raise the tier in the `user_limits` row.
**Verify:** in Admin room → *AI usage today* graph resets to 0 at 00:00 UTC.

## 2. AI Gateway returns 429

**Cause:** Lovable AI Gateway global throttle.
**Fix:** retry with exponential backoff (already implemented for one retry).
If sustained, degrade UI to *"AI busy — try in a minute"* toast.
**Verify:** `ai_gateway_logs` shows the 429s clearing within ~60s.

## 3. Jina scrape returns 401 / 402

**Cause:** `JINA_API_KEY` missing, rotated, or quota exhausted.
**Fix:** rotate the key in Lovable Cloud → Secrets, or top up the Jina plan.
**Verify:** *Trigger Global Scrape Now* returns green toast; a new row
appears in `leads` within a minute.

## 4. n8n webhook times out

**Cause:** n8n instance down or the localtunnel URL expired.
**Fix:** update the URL in *Portfolio & Integrations → n8n webhook URL*
and press *Test*. A green check means the workflow accepted the ping.
**Verify:** trigger *Test* — should return 200 within 5s.

## 5. `/api/public/incoming-lead` returns 401

**Cause:** caller signature does not match `INCOMING_LEAD_SECRET`.
**Fix:** confirm the n8n workflow uses the exact secret name and
`sha256=` hex prefix. See [API.md](API.md) for the curl example.

## 6. Supabase project paused

**Cause:** Lovable Cloud paused after inactivity.
**Fix:** open the app once — Cloud auto-resumes. If still paused, use the
Lovable Cloud panel → *Resume*.

## 7. Dashboard shows 0 leads but rows exist

**Cause 1:** filter/search toolbar still applied. Click *Clear*.
**Cause 2:** you are signed in as a different user than the row owner.
RLS blocks cross-user reads by design.

## 8. Realtime updates not arriving

**Cause:** browser lost the Supabase Realtime WebSocket.
**Fix:** the dashboard resubscribes on `visibilitychange`; if not, hard
refresh. Check the browser console for `CHANNEL_ERROR`.
