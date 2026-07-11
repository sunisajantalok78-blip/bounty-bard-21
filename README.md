# Bounty Hunter

Autonomous lead-intelligence dashboard: live keyword scraping (Jina AI),
MX-validated contacts, AI-generated business proposals, and n8n automation.
Built on TanStack Start + React 19 + Lovable Cloud (Supabase).

## Local development

```bash
bun install
cp .env.example .env   # fill in values, at minimum VITE_SUPABASE_* + SUPABASE_*
bun run dev            # http://localhost:8080
```

## Required secrets

Configure via Lovable Cloud → Secrets (never commit values):

| Name                       | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `SUPABASE_URL`             | Server-side Supabase URL                               |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key for server-side RLS-scoped reads       |
| `SUPABASE_SERVICE_ROLE_KEY`| Admin key — used only in verified webhooks & admin fns |
| `LOVABLE_API_KEY`          | Auto-provisioned; powers Lovable AI Gateway            |
| `JINA_API_KEY`             | Lead scraper                                           |
| `N8N_WEBHOOK_URL`          | Default outbound n8n endpoint                          |
| `INCOMING_LEAD_SECRET`     | Shared secret for `/api/public/*` webhook auth         |
| `APP_ORIGIN`               | Absolute app URL for transactional email links         |

## Public webhook contracts

All `/api/public/*` endpoints require the header:

```
x-webhook-secret: <INCOMING_LEAD_SECRET>
```

### `POST /api/public/incoming-lead`

```json
{
  "source": "LinkedIn",
  "title": "Need CRM setup, Swedish",
  "budget": 500,
  "urgency": "High",
  "description": "…",
  "contact": "hello@example.com"
}
```

Returns `{ ok, id, email, n8n }`. Body cap: 32 KB.

### `POST /api/public/user-events`

```json
{ "event": "profile.viewed", "ref": "opaque-id" }
```

Body cap: 4 KB. **Do not** send raw user emails — this endpoint forwards
to n8n and is not an authenticated user surface.

## Architecture

- `src/routes/` — TanStack file-based routing (pages + `/api/public/*` server routes)
- `src/lib/*.functions.ts` — `createServerFn` handlers (app-internal RPC)
- `src/lib/*.server.ts` — server-only helpers (never imported from client)
- `src/integrations/supabase/` — auto-generated clients & middleware
- `supabase/` — migrations & schema

## Admin bootstrapping

The trigger `handle_new_user_role` (in the database) grants the `admin`
role automatically on sign-up for `sunisajantalok78@gmail.com`. To add
more admins, insert into `public.user_roles` directly.

## Security

See [`SECURITY.md`](./SECURITY.md).

## License

Private.
