# Data Model

All tables live in `public`. RLS is enabled on every table. `service_role`
retains `ALL`; per-role grants below are the exact minimum required.

```mermaid
erDiagram
  auth_users ||--o{ leads : owns
  auth_users ||--o{ my_portfolio : owns
  auth_users ||--o{ scraper_config : owns
  auth_users ||--o{ marketing_plans : owns
  auth_users ||--o{ user_roles : has

  leads {
    uuid id PK
    uuid user_id FK
    text title
    text description
    text source
    text contact
    text status
    text validation_status
    text processing_status
    text urgency
    numeric budget_estimate
    text[] tags
    text ai_pitch
    text business_proposal
    jsonb raw_social_data
    timestamptz created_at
    timestamptz updated_at
  }
  my_portfolio {
    uuid id PK
    uuid user_id FK
    text category
    text content
    timestamptz created_at
  }
  scraper_config {
    uuid id PK
    uuid user_id FK
    text[] keywords
    text[] intents
    text[] platforms
    text geo
    int max_leads_per_run
    text webhook_url
    boolean auto_run
  }
  marketing_plans {
    uuid id PK
    uuid user_id FK
    jsonb plan
    timestamptz created_at
  }
  user_roles {
    uuid id PK
    uuid user_id FK
    app_role role
  }
```

## RLS summary

| Table            | anon | authenticated                                   |
|------------------|------|-------------------------------------------------|
| `leads`          | —    | SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()` |
| `my_portfolio`   | —    | SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()` |
| `scraper_config` | —    | SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()` |
| `marketing_plans`| —    | SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()` |
| `user_roles`     | —    | SELECT own row only. Role writes via `service_role`.     |

## Indexes

- `idx_leads_user_status_created` — `(user_id, status, created_at DESC)`
- `idx_leads_user_created` — `(user_id, created_at DESC)`
- `leads.tags` — GIN

## Triggers

- `trg_leads_updated_at` → `set_updated_at()` refreshes `leads.updated_at`.
- `on_auth_user_created` → `handle_new_user_role()` grants `user` (and `admin`
  for the owner email) on signup.

## Scheduled jobs (pg_cron)

- `nightly-leads-maintenance` — daily 03:15 UTC —
  `purge_stale_ignored_leads()` + `ANALYZE public.leads`.
