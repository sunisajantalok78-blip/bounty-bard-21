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

export type PortfolioRepo = {
  name: string;
  tagline: string;
  stack: string;
};

export const portfolioRepos: PortfolioRepo[] = [
  {
    name: "SiamCheck AI",
    tagline: "Thai LegalTech / RegTech OCR + LLM compliance layer",
    stack: "Python, Tesseract OCR, Claude API, Thai NLP",
  },
  {
    name: "The-Labor-Shield-Thailand",
    tagline: "Thai Labor Protection Act compliance checker",
    stack: "Next.js, Supabase, LLM rule-engine",
  },
  {
    name: "SmartQuote AI",
    tagline: "B2B workflow automation via Make.com / n8n / Claude API",
    stack: "Make.com, n8n, Claude API, Google Workspace",
  },
  {
    name: "v0-half-life-3d-shooter",
    tagline: "HTML5 Canvas 3D rendering game engine",
    stack: "TypeScript, WebGL, Canvas2D, custom raycaster",
  },
  {
    name: "Interactive Smart Restaurant Menu",
    tagline: "F&B matrix via LINE Bot API & Supabase Realtime",
    stack: "Next.js, Supabase Realtime, LINE Messaging API",
  },
  {
    name: "Relocation TH Ecosystem Hub",
    tagline: "Expat tracking database & onboarding form wizards",
    stack: "React, Supabase, multi-step wizard forms",
  },
  {
    name: "Swedish Via English Language Suite",
    tagline: "EdTech web app with mnemonic tutoring",
    stack: "React, spaced-repetition engine, LLM hints",
  },
  {
    name: "High-Volatility Gaming Session Tracker",
    tagline: "High-frequency analytics canvas & risk calculator",
    stack: "React, Canvas charts, statistical risk model",
  },
  {
    name: "VibeVelocity AI",
    tagline: "Dark-mode command center for elite product developers",
    stack: "Next.js, Tailwind, AI orchestration",
  },
];

export const seedLeads: Lead[] = [
  {
    id: "ld_001",
    source: "Algora",
    title: "Automated compliance checker for Thai legal documents",
    budget: 350,
    urgency: "High",
    postedAt: "12:51",
    description:
      "Need an automated compliance checker script for Thai legal documents. Must extract text (OCR) and summarize key risks in English. Bonus if it can flag clauses that conflict with the Thai Labor Protection Act.",
    pitch:
      "Hey — this is literally what I built SiamCheck AI for: a Thai LegalTech OCR + LLM pipeline that ingests Thai-language docs, extracts text, and produces English risk summaries. For Labor Protection Act conflicts I can drop in the rule-engine from my The-Labor-Shield-Thailand repo to auto-flag non-compliant clauses. I can deliver a working CLI + JSON output in 3–4 days. Fixed $350 on delivery. Want me to start with a sample doc?",
    status: "new",
  },
  {
    id: "ld_002",
    source: "LinkedIn",
    title: "Automate B2B client onboarding & proposal-to-CRM pipeline",
    budget: 600,
    urgency: "Critical",
    postedAt: "12:48",
    description:
      "Looking for an expert to automate our B2B client onboarding pipeline. We waste too much time manually entering CRM data from incoming proposals. Prefer n8n / Make or custom API integrations.",
    pitch:
      "This is the exact problem I solved with SmartQuote AI — a B2B workflow automation layer built on Make.com + n8n + Claude API that parses inbound proposals, structures the data, and pushes clean records straight into the CRM. It slashes proposal-to-CRM time by ~80% and removes manual entry entirely. I can wire it into your stack in under a week. Fixed $600, milestone-paid. Want a 15-min architecture call to map your CRM fields?",
    status: "new",
  },
  {
    id: "ld_003",
    source: "Facebook",
    title: "Localized digital menu system for Bangkok restaurant chain",
    budget: 200,
    urgency: "Medium",
    postedAt: "12:42",
    description:
      "Need a localized digital menu system for a restaurant chain in Bangkok with real-time updates and Messenger / LINE bot integration for orders and promotions.",
    pitch:
      "Perfect fit — I built Interactive Smart Restaurant Menu for exactly this: a localized F&B menu running on Supabase Realtime (price/availability updates push instantly to every device) with LINE Bot API hooked in for orders and promo broadcasts. Thai + English out of the box. I can stand up your chain on it within a week. Fixed $200, includes deploy + LINE channel setup. Shall I send the demo link?",
    status: "new",
  },
  {
    id: "ld_004",
    source: "LinkedIn",
    title: "High-end interactive 3D landing page + performance dashboard canvas",
    budget: 450,
    urgency: "High",
    postedAt: "12:30",
    description:
      "Looking for a high-end interactive 3D landing page with complex animations and a high-performance web dashboard canvas. Must be smooth on mid-range laptops.",
    pitch:
      "I write canvas/3D engines from scratch — see my v0-half-life-3d-shooter repo: an HTML5 Canvas 3D rendering engine running a full raycasted shooter at 60fps without WebGL frameworks. I can repurpose that pipeline for your landing page (interactive 3D hero) and the same render loop into a high-FPS dashboard canvas. Delivery in 7 days, fixed $450. Want a Loom of the engine running so you can judge the feel?",
    status: "new",
  },
];

export const seedLogs = [
  { t: "12:51", level: "info" as const, msg: "Algora webhook: $350 Thai-legal OCR bounty matched SiamCheck AI" },
  { t: "12:50", level: "ok" as const, msg: "AI pitch generated for ld_001 (confidence 96%)" },
  { t: "12:48", level: "warn" as const, msg: "LinkedIn lead extracted — CRITICAL, $600 onboarding automation" },
  { t: "12:45", level: "ok" as const, msg: "SmartQuote AI matched to ld_002 (Make/n8n stack)" },
  { t: "12:42", level: "info" as const, msg: "Facebook Bangkok F&B group scan: 1 restaurant lead found" },
  { t: "12:38", level: "info" as const, msg: "Repo matcher: Interactive Smart Restaurant Menu → ld_003" },
  { t: "12:30", level: "ok" as const, msg: "LinkedIn lead ld_004 matched v0-half-life-3d-shooter engine" },
  { t: "12:24", level: "info" as const, msg: "n8n flow #07 triggered: enrich → score → route" },
  { t: "12:18", level: "info" as const, msg: "Portfolio index rebuilt (9 repos, 42 keywords)" },
  { t: "12:05", level: "ok" as const, msg: "System health: all 4 integrations green" },
];

export const seedStats = {
  scanned: 1284,
  pitches: 73,
  conversions: 11,
  earned: 18450,
};

export const developerProfile = {
  name: "Bahdan Los",
  role: "High-Velocity Vibe Coder & AI-Workflow Architect",
  linkedin: "https://www.linkedin.com/in/bahdan-los",
  facebook: "https://www.facebook.com/bahdan.los",
};

export const MOCK_WEBHOOK_URL =
  "https://project--e9580fa5-13a7-457e-975e-91b30a207a34.lovable.app/api/public/incoming-lead";

export const NOTIFY_EMAIL = "sunisajantalok78@gmail.com";
