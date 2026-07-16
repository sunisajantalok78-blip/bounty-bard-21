# Public HTTP API

All public endpoints live under `/api/public/*`. This prefix bypasses
Lovable's edge auth — each handler enforces its own auth (HMAC).

Base URL (production): `https://bounty-bard-21.lovable.app`

---

## POST `/api/public/incoming-lead`

Accept a lead from n8n or any scraper. Body is verified with
`INCOMING_LEAD_SECRET` via timing-safe HMAC-SHA256.

**Headers**

| Header               | Value                                                |
|----------------------|------------------------------------------------------|
| `content-type`       | `application/json`                                   |
| `x-signature`        | `sha256=<hex hmac of raw body>`                      |

**Body** (Zod-validated)

```json
{
  "user_id": "uuid",
  "title": "string",
  "description": "string",
  "source": "linkedin | fiverr | reddit | web",
  "contact": "email or url",
  "urgency": "low | medium | high",
  "budget_estimate": 500,
  "raw": { "any": "provider payload, <= 32KB" }
}
```

**Sample curl**

```bash
BODY='{"user_id":"...","title":"Need landing page","source":"web","contact":"a@b.com"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$INCOMING_LEAD_SECRET" | awk '{print $2}')

curl -X POST https://bounty-bard-21.lovable.app/api/public/incoming-lead \
  -H "content-type: application/json" \
  -H "x-signature: sha256=$SIG" \
  -d "$BODY"
```

**Responses**

| Status | Meaning                              |
|--------|--------------------------------------|
| 200    | `{ "ok": true, "id": "<uuid>" }`     |
| 400    | Zod validation failed                |
| 401    | Missing / bad signature              |
| 413    | Body over 32 KB                      |
| 500    | Server error (safe message returned) |

---

## POST `/api/public/user-events`

Best-effort observability sink for browser errors and lifecycle events.
No PII, no auth — rate-shape by the browser (`keepalive` + debounce).

```json
{ "event": "app.error", "context": { "route": "/dashboard" } }
```

Always returns `204`.
