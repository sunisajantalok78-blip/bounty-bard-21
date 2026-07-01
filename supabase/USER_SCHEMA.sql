-- ============================================================
-- Bounty Hunter — knowledge base schema for YOUR Supabase project
-- Run this once in the Supabase SQL Editor of project elyfytgzhuaogcfdzkqe
-- (Dashboard → SQL Editor → New query → paste → Run)
-- Safe to re-run; every statement is idempotent.
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Leads (mirrored from the app + inbound n8n scrapes)
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'webhook',
  title         text not null,
  budget        numeric,
  urgency       text not null default 'Medium',
  description   text,
  contact       text,
  score         numeric,
  status        text not null default 'new',       -- new | pitched | won | lost | ignored
  pitch         text,
  raw           jsonb,
  n8n_forwarded boolean not null default false,
  email_sent    boolean not null default false,
  email_error   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Marketing plans (versioned history)
create table if not exists public.marketing_plans (
  id            uuid primary key default gen_random_uuid(),
  profile_links jsonb not null default '{}'::jsonb,
  goals         text,
  plan          jsonb not null,
  created_at    timestamptz not null default now()
);

-- 3. Profile audit snapshots (for progress tracking)
create table if not exists public.audit_snapshots (
  id         uuid primary key default gen_random_uuid(),
  platform   text not null,
  url        text,
  score      numeric,
  audit      jsonb not null,
  reason     text,                                -- "manual refresh" | "task-completed" | ...
  created_at timestamptz not null default now()
);

-- 4. Tasks (7-day plan items with completion state)
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  day          text,
  task         text not null,
  why          text,
  time_of_day  text,
  completed    boolean not null default false,
  completed_at timestamptz,
  source       text default 'plan',               -- plan | chat | manual
  created_at   timestamptz not null default now()
);

-- 5. AI Coach chat history
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  role       text not null check (role in ('user','assistant','system')),
  content    text not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

-- 6. Confirmed knowledge base (things the AI has learned and validated)
create table if not exists public.knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,                       -- e.g. "linkedin_hook_style", "fiverr_pricing"
  fact        text not null,
  confidence  numeric not null default 0.5,        -- 0..1
  evidence    jsonb,                                -- links / lead ids / outcomes that support it
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists knowledge_base_topic_idx on public.knowledge_base (topic);

-- 7. n8n dispatch log (what the app has sent outbound)
create table if not exists public.n8n_events (
  id         uuid primary key default gen_random_uuid(),
  event_type text not null,                        -- lead.new | task.completed | pitch.sent | plan.generated | test
  payload    jsonb not null,
  status     text not null default 'pending',     -- pending | ok | error
  response   jsonb,
  error      text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Data-API grants (Supabase requires them explicitly)
-- These tables are written by the SERVICE ROLE from your app's
-- server functions. anon SELECT is granted so your dashboard can
-- read history without a signed-in user; tighten later if you add
-- auth.
-- ------------------------------------------------------------
grant select on public.leads             to anon;
grant select on public.marketing_plans   to anon;
grant select on public.audit_snapshots   to anon;
grant select on public.tasks             to anon;
grant select on public.chat_messages     to anon;
grant select on public.knowledge_base    to anon;
grant select on public.n8n_events        to anon;

grant select, insert, update, delete on public.leads           to authenticated;
grant select, insert, update, delete on public.marketing_plans to authenticated;
grant select, insert, update, delete on public.audit_snapshots to authenticated;
grant select, insert, update, delete on public.tasks           to authenticated;
grant select, insert, update, delete on public.chat_messages   to authenticated;
grant select, insert, update, delete on public.knowledge_base  to authenticated;
grant select, insert, update, delete on public.n8n_events      to authenticated;

grant all on public.leads           to service_role;
grant all on public.marketing_plans to service_role;
grant all on public.audit_snapshots to service_role;
grant all on public.tasks           to service_role;
grant all on public.chat_messages   to service_role;
grant all on public.knowledge_base  to service_role;
grant all on public.n8n_events      to service_role;

-- Enable RLS with permissive anon-read policies (write only via service role)
alter table public.leads             enable row level security;
alter table public.marketing_plans   enable row level security;
alter table public.audit_snapshots   enable row level security;
alter table public.tasks             enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.knowledge_base    enable row level security;
alter table public.n8n_events        enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'leads','marketing_plans','audit_snapshots','tasks',
    'chat_messages','knowledge_base','n8n_events'
  ]) loop
    execute format('drop policy if exists "anon_read_%s" on public.%I', t, t);
    execute format('create policy "anon_read_%s" on public.%I for select to anon using (true)', t, t);
  end loop;
end $$;

-- updated_at triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

drop trigger if exists kb_touch on public.knowledge_base;
create trigger kb_touch before update on public.knowledge_base
  for each row execute function public.touch_updated_at();
