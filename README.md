# Bounty Hunter — AI Lead & Proposal Engine

Autonomous dashboard that finds paid web-dev work for a solo operator: scrapes
intent-based queries from your own portfolio, validates contact data, drafts a
tailored proposal with AI, and pipes the whole thing through n8n for outreach.

- **Live app:** https://bounty-bard-21.lovable.app
- **Stack:** TanStack Start (React 19, Vite 7) · Supabase (Postgres + Auth + RLS) · Lovable AI Gateway (Gemini) · Jina AI · n8n

---

## 60-second tour

1. **Sign in** with your email (admin: `sunisajantalok78@gmail.com`).
2. **Portfolio & Context** — add projects. Their categories become the seeds
   for scraper queries.
3. **Scraper** — set intent + geo + platforms + max leads/run, hit
   *Trigger Global Scrape Now*. n8n runs the queries, writes results into
   `leads` with `processing_status='pending'`.
4. **Lead Inbox** — search / filter / tag / bulk-update leads. Click
   *Generate Pro Proposal* to draft a pitch via the AI Gateway. Copy the
   pitch or open a WhatsApp / Messenger deep link.
5. **Payouts & Integrations** — configure your n8n webhook URL,
   export/import scraper settings.

## Docs

| File                                        | What's in it                                             |
|---------------------------------------------|----------------------------------------------------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, request flow                             |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md)     | Tables, columns, RLS summary                             |
| [docs/API.md](docs/API.md)                   | Public `/api/*` contracts with `curl` samples            |
| [docs/N8N.md](docs/N8N.md)                   | Required n8n workflows + payload shapes                  |
| [docs/GOVERNANCE.md](docs/GOVERNANCE.md)     | Rate caps, cooldowns, dedup, auto-purge                  |
| [docs/RUNBOOK.md](docs/RUNBOOK.md)           | Incidents & fixes                                        |
| [docs/DEPLOY.md](docs/DEPLOY.md)             | Publish flow, release checklist, rollback                |
| [SECURITY.md](SECURITY.md)                   | Threat model + how to report a vulnerability             |
| [CONTRIBUTING.md](CONTRIBUTING.md)           | Local dev, tests, commit style                           |

## Required secrets

Set these in **Lovable → Cloud → Secrets** (server-only):

| Name                          | Purpose                                             |
|-------------------------------|-----------------------------------------------------|
| `LOVABLE_API_KEY`             | AI Gateway (managed — auto-rotated)                 |
| `JINA_API_KEY`                | Web scraping via r.jina.ai                          |
| `INCOMING_LEAD_SECRET`        | HMAC signature for `/api/public/incoming-lead`      |
| `N8N_WEBHOOK_URL`             | Default n8n endpoint (users can override in-app)    |
| `SUPABASE_*`                  | Auto-managed by Lovable Cloud                       |

## Local development

```bash
bun install
bun dev            # http://localhost:8080
bun test           # Vitest
bunx tsgo          # typecheck
```

## License

MIT — see [LICENSE](LICENSE).
