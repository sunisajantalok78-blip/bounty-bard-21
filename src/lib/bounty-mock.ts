export type Lead = {
  id: string;
  source: "GitHub" | "Algora" | "LinkedIn" | "Facebook" | "Upwork";
  title: string;
  budget: number;
  urgency: "Low" | "Medium" | "High" | "Critical";
  postedAt: string;
  description: string;
  pitch: string;
  status: "new" | "pitched" | "won";
};

export const seedLeads: Lead[] = [
  {
    id: "ld_001",
    source: "Algora",
    title: "Fix WebSocket reconnection bug in real-time chat SDK",
    budget: 850,
    urgency: "High",
    postedAt: "12:51",
    description:
      "Our Node.js WebSocket client drops connections after ~30s idle behind certain corporate proxies. Looking for someone with deep WS / socket.io experience to patch reconnect-with-backoff, write tests, and open a PR against our open source repo. Stack: Node 20, TypeScript, socket.io 4.x.",
    pitch:
      "Hey team — I noticed the WS drop issue and I've shipped two production reconnect layers for similar setups (one in my `realtime-sync` repo on GitHub using exponential backoff + heartbeat, another in a chat SaaS I built). I can deliver a tested PR with backoff, jitter, and a proxy-friendly heartbeat within 24h. Happy to scope this to a fixed $850 — payable on merge. Want me to start?",
    status: "new",
  },
  {
    id: "ld_002",
    source: "GitHub",
    title: "Bounty: Migrate Next.js 13 app to App Router + Server Actions",
    budget: 1400,
    urgency: "Medium",
    postedAt: "12:48",
    description:
      "Legacy Next.js 13 pages-router project (~40 routes). Need clean migration to App Router with Server Actions, RSC where appropriate, and Tailwind v4 upgrade. Repo is public, full test suite included.",
    pitch:
      "I've done two App Router migrations of similar scope this quarter — one is live in my pinned repo `next-migrate-toolkit`. I can run the migration in 4 phases (routing → data → server actions → tailwind v4), keep tests green at every step, and ship in ~6 days. Fixed $1,400 works. Want a diff plan first?",
    status: "new",
  },
  {
    id: "ld_003",
    source: "LinkedIn",
    title: "YC startup needs Stripe + multi-tenant billing built in 10 days",
    budget: 3200,
    urgency: "Critical",
    postedAt: "12:42",
    description:
      "Pre-seed B2B SaaS. Need Stripe Connect, per-org subscriptions, usage metering, invoicing, and a customer portal. React + Supabase backend already in place.",
    pitch:
      "I shipped exactly this combo (Stripe Connect + usage metering on Supabase) in my repo `tenant-billing-kit` — it's battle-tested. I can drop it in, customize, wire webhooks, and run a paid sandbox demo by day 4. $3,200 fixed, milestone-paid. Free 20-min architecture call to confirm scope?",
    status: "new",
  },
  {
    id: "ld_004",
    source: "Facebook",
    title: "Shopify Hydrogen storefront perf optimization",
    budget: 600,
    urgency: "Low",
    postedAt: "12:30",
    description:
      "Hydrogen storefront LCP is 4.2s on mobile. Need a perf engineer to get it under 2.0s without sacrificing CMS flexibility.",
    pitch:
      "Hydrogen perf is one of my niches — see `hydrogen-perf-audit` on my GitHub. I'll run a Lighthouse + WebPageTest audit, ship a PR (image pipeline, RSC streaming, font subset, edge cache headers) and guarantee sub-2s LCP or refund. $600 flat.",
    status: "new",
  },
  {
    id: "ld_005",
    source: "Algora",
    title: "Bounty: TypeScript types broken in v3 release",
    budget: 250,
    urgency: "Medium",
    postedAt: "12:18",
    description:
      "Generic inference regressed in v3.0 for the `useStore` hook. Need a typed reproduction + fix + tests.",
    pitch:
      "Quick win — looks like a conditional inference regression. I'll open a failing test + fix PR today. $250 on merge works.",
    status: "pitched",
  },
  {
    id: "ld_006",
    source: "Upwork",
    title: "Build AI-powered resume parser API",
    budget: 1800,
    urgency: "High",
    postedAt: "11:55",
    description:
      "Need a production API that takes PDF/DOCX resumes and returns structured JSON (skills, experience, education) using LLM extraction. Should handle 1000s/day.",
    pitch:
      "I've built this exact pipeline — `resume-parse-edge` on my GitHub uses streaming LLM extraction + schema validation, runs on edge functions, ~$0.002/parse. I can deliver a hosted API + docs in 5 days. $1,800 fixed.",
    status: "new",
  },
];

export const seedLogs = [
  { t: "12:51", level: "info" as const, msg: "Algora webhook: new $850 bounty matched stack (Node/WS)" },
  { t: "12:50", level: "ok" as const, msg: "AI pitch generated for lead ld_001 (confidence 94%)" },
  { t: "12:48", level: "info" as const, msg: "GitHub Issues scan: 1 high-priority bounty found" },
  { t: "12:45", level: "ok" as const, msg: "Pitch sent → ld_005 via n8n webhook (status 200)" },
  { t: "12:42", level: "warn" as const, msg: "LinkedIn lead extracted — CRITICAL urgency, $3.2k" },
  { t: "12:38", level: "info" as const, msg: "Scanning Facebook dev groups (12 groups, 340 posts)" },
  { t: "12:30", level: "ok" as const, msg: "Conversion logged: ld_998 paid $1,200 via Stripe" },
  { t: "12:24", level: "info" as const, msg: "n8n flow #07 triggered: enrich lead → score → route" },
  { t: "12:18", level: "info" as const, msg: "Algora: TS regression bounty matched (low effort)" },
  { t: "12:05", level: "ok" as const, msg: "System health: all 4 integrations green" },
];

export const seedStats = {
  scanned: 1284,
  pitches: 73,
  conversions: 11,
  earned: 18450,
};
