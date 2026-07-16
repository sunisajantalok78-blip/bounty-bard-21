# n8n Integration

The app is transport-agnostic — every outbound call is a signed POST to a
single webhook URL you own. Configure it in **Portfolio & Integrations →
n8n webhook URL** (per-user, stored in `scraper_config.webhook_url`).

## Payload envelope

Every dispatch shares this shape:

```json
{
  "action": "scrape_now | generate_proposal | validate_contact | test",
  "user_id": "uuid",
  "timestamp": "2026-07-15T00:00:00Z",
  "payload": { ... }
}
```

## Actions

### `action: "scrape_now"`

Sent when the user hits *Trigger Global Scrape Now*.

```json
{
  "payload": {
    "queries": ["site:linkedin.com \"need shopify dev\" romania", "..."],
    "intents": ["hiring","urgent"],
    "geo": "EU",
    "platforms": ["linkedin.com","fiverr.com"],
    "max_leads": 25,
    "callback_url": "https://bounty-bard-21.lovable.app/api/public/incoming-lead",
    "callback_secret_name": "INCOMING_LEAD_SECRET"
  }
}
```

Your workflow: run each query (via Jina, SerpAPI, or your own scraper) →
for each result POST it back to `callback_url` with the HMAC signature.
See [API.md](API.md).

### `action: "generate_proposal"`

Sent after the AI Gateway drafts a proposal. Use it to log, send to
CRM, or trigger a Slack notification.

```json
{
  "payload": {
    "lead_id": "uuid",
    "title": "...",
    "contact": "...",
    "proposal": "full markdown proposal"
  }
}
```

### `action: "validate_contact"`

Optional — mirror the server-side DNS MX check into your own pipeline.

```json
{ "payload": { "lead_id": "uuid", "contact": "a@b.com" } }
```

### `action: "test"`

Sent by the *Test* button next to the webhook field. Your workflow should
respond `200 OK` with any body.

## Recommended n8n workflow skeleton

```text
[Webhook trigger]
   └─ Switch on {{$json.action}}
       ├─ scrape_now  → Loop queries → HTTP Request (Jina) → HTTP Request (callback)
       ├─ generate_proposal → Notion / Gmail / Slack
       ├─ validate_contact  → DNS / Hunter.io
       └─ test        → Respond 200
```
