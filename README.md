# Bounty Hunter — Autonomous Lead Intelligence Dashboard

An always-on, AI-powered lead-discovery and outreach platform for solo web developers and small agencies. Bounty Hunter continuously scrapes the open web for buying-intent signals, validates the resulting contacts, drafts a portfolio-grounded business proposal for each opportunity, and hands the ready-to-send pitch to the operator through a modern dark-mode dashboard — without ever sending outreach automatically.

Built for [Bahdan Los / Sunisa Jantalok](https://www.fiverr.com/s/5rW6QZ4), production-hardened, and deployed on Lovable Cloud.

Live app: <https://bounty-bard-21.lovable.app>

---

## What it does

1. **Scrapes** — Portfolio-driven queries (intent + geo + platform scoping, `site:linkedin.com`, `site:fiverr.com`, etc.) run through Jina AI Reader to pull real search results.
2. **Ingests** — Raw hits are normalized into `leads` with `source`, `title`, `contact`, `raw_social_data`, and a status pipeline (`new → scraping → scraped → validating → validated → pending`). It never auto-sends anything.
3. **Validates** — Server-side DNS MX lookup on every email domain marks contacts `valid` / `invalid` before you spend a pitch on them.
4. **Pitches** — On demand, an authenticated server function calls the Lovable AI Gateway (Google Gemini) with your portfolio context and returns both a short pitch and a full Pro Business Proposal, saved back to the lead.
5. **Governs** — Daily 30-pitch cap per user, 10-second anti-bulk-click cooldown, ID-based deduplication, and a `pg_cron` job that purges rejected/invalid leads after 7 days.
6. **Coaches** — A persistent AI Marketing Coach chat remembers your profile-audit history, tracks completed tasks, and tells you what to do next with expected income and timelines.
7. **Automates** — Every new lead can fire your personal n8n webhook (per-user, validated), and a public `/api/public/incoming-lead` endpoint (shared-secret authenticated) accepts inbound webhooks from n8n / Make / Zapier.

Nothing in the outreach pipeline is sent without a human click. This is a **safe-execution** system by design.

---

## Feature tour

| Area | Highlights |
| --- | --- |
| **System Monitor** | Live metrics bar, sync status, governance badge (pitches used today), automation toggles. |
| **Portfolio & Context Settings** | 9 real portfolio projects seeded (SiamCheck AI, SmartQuote AI, …). Categories drive scraper queries. |
| **Lead Inbox & AI Pitcher** | Quick-ingest form, Kanban status pipeline, expandable full proposal view, WhatsApp / Telegram / Messenger deep-links, copy-pitch button, per-lead "Generate Pro Proposal" + "Validate contact (DNS)". |
| **Scraper Control** | Intent + Geo + Platform + Max-leads-per-run limiter, "Trigger Global Scrape Now", per-user n8n webhook with live URL validation, JSON export/import of scraper config. |
| **Payouts & Integrations** | Copyable per-user mock webhook URL, n8n test button, incoming-lead endpoint contract. |
| **Profile Audit + AI Coach** | Chat history persisted, task-completion checkboxes trigger re-audit, per-link "Update" buttons re-check Fiverr / LinkedIn / Facebook / GitHub profiles. Audit snapshots stored for chronological progress tracking. |
| **Admin Room** | Owner-only dashboard (email hardcoded via `handle_new_user_role` trigger) for user stats, lead totals, and app-wide settings. |

---

## Tech stack

- **Frontend** — React 19, TanStack Router / Start v1, TanStack Query, Tailwind CSS v4, shadcn/ui, Radix primitives, Vite 7.
- **Backend** — TanStack Start server functions (`createServerFn`) + server routes (`/api/public/*`), running on Cloudflare Workers via Lovable Cloud.
- **Data** — Lovable Cloud (Postgres + Row-Level Security + Realtime + Auth + `pg_cron`).
- **AI** — Lovable AI Gateway (Google Gemini 1.5 Flash) for pitch generation, proposal drafting, and the Marketing Coach.
- **Scraping** — Jina AI Reader (`r.jina.ai`).
- **DNS validation** — Node `dns/promises` (server-only).
- **Automation** — n8n (per-user webhook URL + shared-secret signed inbound webhook).
- **Testing** — Vitest (24 tests: schemas, HTTP helpers, pitch governance).

---

## Local development

```bash
bun install
cp .env.example .env    # fill in the required variables (see below)
bun run dev             # http://localhost:8080
bun run test            # 24 tests
bun run build           # production build
```

> Use `bun run test` — NOT `bun test`. The former runs Vitest; the latter runs Bun's own incompatible test runner.

---

## Required secrets

All secrets live in **Lovable Cloud → Secrets** and are read via `process.env` **inside server handlers only** (never at module scope of shared files). Publishable/anon keys are safe in the browser.

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Server-side Cloud URL |
| `SUPABASE_PUBLISHABLE_KEY` | RLS-scoped server reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin ops only (verified webhooks, `has_role`-gated fns) |
| `LOVABLE_API_KEY` | Auto-provisioned; powers the AI Gateway |
| `JINA_API_KEY` | Authenticated Jina Reader scraper requests |
| `N8N_WEBHOOK_URL` | Default outbound n8n endpoint |
| `INCOMING_LEAD_SECRET` | Shared secret for `/api/public/*` webhook auth (generated via `generate_secret`, 32+ chars, timing-safe compared) |
| `APP_ORIGIN` | Absolute URL used in transactional email links |

`VITE_SUPABASE_*` variables are bundled into the browser and are safe to commit.

---

## Public webhook contracts

Every `/api/public/*` route requires:

```
x-webhook-secret: <INCOMING_LEAD_SECRET>
```

Missing or wrong header → `401 unauthorized`. Body larger than the cap → `413 payload_too_large`. Invalid JSON → `400 invalid_json`. Zod failure → `400 validation_failed` with `details`.

### `POST /api/public/incoming-lead` (cap: 32 KB)

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

Returns `{ ok, id, email, n8n }`.

### `POST /api/public/user-events` (cap: 4 KB)

```json
{ "event": "profile.viewed", "ref": "opaque-id" }
```

**Never** send raw user emails to this endpoint — it forwards to n8n and is not an authenticated user surface. Use opaque IDs you issued.

---

## Security posture

- **RLS everywhere** — `leads`, `marketing_plans`, `my_portfolio`, `scraper_config`, `user_roles` are all owner-scoped (`user_id = auth.uid()`) with admin override via `has_role(auth.uid(),'admin')`.
- **No blanket policies** — Every policy is scoped; no `USING (true)`.
- **`SECURITY DEFINER` functions are locked** — `handle_new_user_role` and `purge_stale_ignored_leads` have `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated`. `has_role` is `SECURITY INVOKER`.
- **Leaked-password protection** — HIBP check enabled on the Auth provider.
- **Public routes** — Timing-safe shared-secret verification (`safeEqual`), hard body-size caps (`readBoundedText`), Zod validation on every field, generic error codes to the client, full detail via `logError` server-side only.
- **Secrets never leak** — `logError` scrubs any key matching `/^(authorization|apikey|token|password|secret|cookie|set-cookie)$/i` before console output.
- **Rate-limiting & governance** — 30 pitches/user/day, 10-second cooldown, ID dedup, 7-day auto-purge of rejected leads via `pg_cron`.
- **Bearer-token flow** — Protected server functions use `requireSupabaseAuth` middleware; the client attaches the session token via the generated `attachSupabaseAuth` `functionMiddleware`.

See [`SECURITY.md`](./SECURITY.md) for the responsible-disclosure policy.

---

## Architecture

```
src/
├── routes/                          # TanStack file-based routing
│   ├── __root.tsx                   # app shell, head metadata
│   ├── index.tsx                    # landing
│   ├── auth.tsx                     # sign-in / sign-up
│   ├── _authenticated/
│   │   ├── route.tsx                # managed auth gate → redirect to /auth
│   │   ├── dashboard.tsx            # main 4-tab dashboard
│   │   └── admin.tsx                # owner-only admin room
│   └── api/public/                  # public webhooks (secret-authenticated)
│       ├── incoming-lead.ts
│       └── user-events.ts
├── lib/
│   ├── *.functions.ts               # createServerFn (RPC to browser)
│   ├── *.server.ts                  # server-only helpers (never client-imported)
│   ├── schemas.ts                   # shared Zod schemas
│   ├── http.server.ts               # CORS, safeEqual, readBoundedText
│   ├── log.server.ts                # secret-scrubbing logger
│   ├── pitch-governance.ts          # daily cap + cooldown
│   └── persist.ts                   # localStorage hook
├── integrations/supabase/           # auto-generated clients & middleware
└── start.ts                         # registers attachSupabaseAuth
supabase/                            # migrations + generated schema
```

Rules of thumb:
- **App-internal server logic** → `createServerFn` from `@tanstack/react-start`.
- **Raw HTTP / webhooks / cron** → server routes under `src/routes/api/public/`.
- **Never** import `.server.ts` files from client code (blocked by the bundler).
- **Never** hardcode colors — use the semantic tokens in `src/styles.css`.

---

## Admin bootstrapping

The database trigger `handle_new_user_role` grants the `admin` role automatically the first time `sunisajantalok78@gmail.com` signs up. To add more admins:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'someone@example.com'
on conflict do nothing;
```

---

## n8n integration

- **Inbound** (n8n → Bounty Hunter) — `POST /api/public/incoming-lead` with `x-webhook-secret` header.
- **Outbound** (Bounty Hunter → n8n) — Set your personal webhook URL in the **Scraper Control** tab. It's validated client-side before Test / Trigger Global Scrape become enabled. Each user has their own URL persisted in `scraper_config` (owner-scoped RLS).
- Export/import scraper config as JSON from the same panel.

---

## Production readiness — how to ship

1. **Set every secret** in Lovable Cloud → Secrets (table above). None can be blank in production.
2. **Run the test suite**: `bun run test` → must show 24 passed.
3. **Run the build**: `bun run build` → must exit 0.
4. **Trigger a security scan** from the Lovable UI and confirm no unresolved critical findings.
5. **Publish** from the Lovable editor (Publish button, top-right). Frontend changes deploy on Update; backend (server functions, migrations) deploys immediately.
6. **Verify the live app**:
   - Sign in at `/auth`.
   - Ingest a test lead via the Quick Ingest form; confirm it appears in the Inbox with `status: new`.
   - Click **Generate Pro Proposal** — proposal populates.
   - Click **Validate contact (DNS)** — status flips to `valid` / `invalid`.
   - `curl` the public webhook with your `INCOMING_LEAD_SECRET` and confirm `{ ok: true, id: ... }`.
7. **Wire n8n** — Paste your webhook URL into Scraper Control → Test. Configure your n8n flow to POST enriched leads back to `/api/public/incoming-lead`.
8. **(Optional) Custom domain** — Project Settings → Domains, after publishing.

Optional hardening after go-live: enable Cloud daily backups, raise the Cloud instance size if traffic grows, and rotate `INCOMING_LEAD_SECRET` quarterly.

---

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Vite dev server on `http://localhost:8080` |
| `bun run build` | Production build |
| `bun run build:dev` | Dev-mode build (used for prerender checks) |
| `bun run preview` | Preview the production build locally |
| `bun run test` | Vitest suite (24 tests) |
| `bun run test:watch` | Vitest in watch mode |
| `bun run lint` | ESLint |
| `bun run format` | Prettier write |

---

## License

Private. All rights reserved © Sunisa Jantalok / Bahdan Los.
