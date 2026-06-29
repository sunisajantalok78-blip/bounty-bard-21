import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cpu,
  DollarSign,
  Eye,
  Facebook,
  Filter,
  Flame,
  Gauge,
  Github,
  Inbox,
  Linkedin,
  Plug,
  Radar,
  Rocket,
  Send,
  Settings2,
  Sparkles,
  Terminal,
  TrendingUp,
  Wallet,
  Webhook,
  Wifi,
  Zap,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import {
  type Lead,
  MOCK_WEBHOOK_URL,
  NOTIFY_EMAIL,
  developerProfile,
  portfolioRepos,
  seedLeads,
  seedLogs,
  seedStats,
} from "@/lib/bounty-mock";
import { Copy, Check, BrainCircuit, CalendarClock, LineChart, Loader2, Mail, MessageSquare, RotateCcw, Save, Target, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateMarketingPlan, type MarketingPlan } from "@/lib/marketing-bot.functions";
import { chatWithMarketingBot } from "@/lib/marketing-chat.functions";
import { usePersistedState, clearPersisted } from "@/lib/persist";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bounty Hunter — Autonomous AI Lead Engine" },
      {
        name: "description",
        content:
          "Autonomous AI dashboard that scans GitHub, Algora, LinkedIn and Facebook for paid dev bounties and auto-pitches with your portfolio.",
      },
      { property: "og:title", content: "Bounty Hunter — Autonomous AI Lead Engine" },
      {
        property: "og:description",
        content: "Hunt, pitch, and convert paid dev work on autopilot.",
      },
    ],
  }),
  component: Dashboard,
});

type LogEntry = { t: string; level: "info" | "ok" | "warn"; msg: string };

const SOURCE_ICONS: Record<Lead["source"], typeof Github> = {
  GitHub: Github,
  Algora: Sparkles,
  LinkedIn: Linkedin,
  Facebook: Facebook,
  Upwork: Rocket,
};

const URGENCY_STYLES: Record<Lead["urgency"], string> = {
  Low: "bg-info/15 text-info border-info/30",
  Medium: "bg-warning/15 text-warning border-warning/30",
  High: "bg-[oklch(0.78_0.18_30)]/15 text-[oklch(0.82_0.18_40)] border-[oklch(0.78_0.18_30)]/30",
  Critical: "bg-destructive/15 text-destructive border-destructive/40",
};

function Dashboard() {
  const [automation, setAutomation] = usePersistedState("automation", true);
  const [autoPilot, setAutoPilot] = usePersistedState("autoPilot", false);
  const [leads, setLeads] = usePersistedState<Lead[]>("leads", seedLeads);
  const [selectedId, setSelectedId] = usePersistedState<string>(
    "selectedLeadId",
    seedLeads[0].id,
  );
  const [logs, setLogs] = usePersistedState<LogEntry[]>("logs", seedLogs);
  const [stats, setStats] = usePersistedState("stats", seedStats);
  const [tick, setTick] = useState(0);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? leads[0],
    [leads, selectedId],
  );

  // Simulated live log stream
  useEffect(() => {
    if (!automation) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const samples: LogEntry[] = [
        { t, level: "info", msg: "Scanning GitHub Issues (labels: bounty, help-wanted)…" },
        { t, level: "ok", msg: "n8n webhook ACK: pitch delivered (200 OK, 142ms)" },
        { t, level: "info", msg: "Algora bounty board crawled (38 new, 4 matched stack)" },
        { t, level: "warn", msg: "LinkedIn rate-limited briefly — backing off 4s" },
        { t, level: "ok", msg: "Lead scored 91 — routed to AI pitcher" },
        { t, level: "info", msg: "Facebook dev group scan complete (12 groups)" },
      ];
      const pick = samples[Math.floor(Math.random() * samples.length)];
      setLogs((prev) => [pick, ...prev].slice(0, 60));
      setStats((s) => ({ ...s, scanned: s.scanned + Math.floor(Math.random() * 3) + 1 }));
    }, 2200);
    return () => window.clearInterval(id);
  }, [automation, setLogs, setStats]);

  const handleSendPitch = (lead: Lead) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: "pitched" } : l)),
    );
    setStats((s) => ({ ...s, pitches: s.pitches + 1 }));
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setLogs((prev) => [
      { t, level: "ok", msg: `Pitch sent → ${lead.id} via n8n webhook (status 200)` },
      ...prev,
    ]);
    toast.success(autoPilot ? "Auto-pilot: pitch dispatched" : "Pitch sent via webhook", {
      description: `${lead.source} • $${lead.budget.toLocaleString()} • ${lead.urgency}`,
    });
  };

  const handleResetAll = () => {
    setStats({ scanned: 0, pitches: 0, conversions: 0, earned: 0 });
    setLogs([
      {
        t: new Date().toTimeString().slice(0, 5),
        level: "ok",
        msg: "Counters reset to zero — fresh start.",
      },
    ]);
    setLeads((prev) => prev.map((l) => ({ ...l, status: "new" as const })));
    toast.success("All numbers reset to 0", {
      description: "Profile links & marketing plan kept. Tracking starts from now.",
    });
  };


  return (
    <div className="min-h-screen text-foreground">
      <Toaster theme="dark" position="bottom-right" />
      <TopBar automation={automation} tick={tick} />

      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-8">
        <Tabs defaultValue="monitor" className="w-full">
          <TabsList className="glass-panel mb-6 h-12 w-full justify-start gap-1 rounded-xl p-1">
            <TabTrigger value="monitor" icon={Gauge} label="System Monitor" />
            <TabTrigger value="portfolio" icon={Settings2} label="Portfolio & Context" />
            <TabTrigger value="inbox" icon={Inbox} label="Lead Inbox & AI Pitcher" />
            <TabTrigger value="bot" icon={BrainCircuit} label="AI Marketing Bot" />
            <TabTrigger value="payouts" icon={Wallet} label="Payouts & Integrations" />
          </TabsList>

          <TabsContent value="monitor" className="mt-0">
            <MonitorTab
              automation={automation}
              setAutomation={setAutomation}
              stats={stats}
              logs={logs}
              onReset={handleResetAll}
            />
          </TabsContent>


          <TabsContent value="portfolio" className="mt-0">
            <PortfolioTab />
          </TabsContent>

          <TabsContent value="inbox" className="mt-0">
            <InboxTab
              leads={leads}
              selected={selected}
              setSelectedId={setSelectedId}
              autoPilot={autoPilot}
              setAutoPilot={setAutoPilot}
              onSend={handleSendPitch}
              onPitchChange={(id, pitch) =>
                setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, pitch } : l)))
              }
            />
          </TabsContent>

          <TabsContent value="bot" className="mt-0">
            <MarketingBotTab />
          </TabsContent>

          <TabsContent value="payouts" className="mt-0">
            <PayoutsTab stats={stats} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Top Bar ---------------- */

function TopBar({ automation, tick }: { automation: boolean; tick: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-neon to-accent neon-glow">
            <Radar className="h-5 w-5 text-neon-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">Bounty Hunter</h1>
              <Badge variant="outline" className="border-neon/40 bg-neon/10 text-[10px] font-semibold uppercase tracking-wider text-neon">
                v1.0
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Autonomous AI lead & bounty engine</p>
          </div>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          <StatusPill on={automation} tick={tick} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" />
            <span className="font-mono">CPU 12%</span>
            <span className="text-border">·</span>
            <Wifi className="h-3.5 w-3.5" />
            <span className="font-mono">42ms</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function StatusPill({ on, tick }: { on: boolean; tick: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-neon animate-neon-pulse" : "bg-muted-foreground"}`}
      />
      <span className="text-xs font-medium">
        {on ? "Active · Scanning" : "Standby"}
        {on && (
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
            tick {String(tick).padStart(4, "0")}
          </span>
        )}
      </span>
    </div>
  );
}

function TabTrigger({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: typeof Gauge;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 gap-2 rounded-lg px-4 text-sm font-medium text-muted-foreground transition data-[state=active]:bg-neon/15 data-[state=active]:text-neon data-[state=active]:shadow-[0_0_0_1px_oklch(0.86_0.22_150/0.3),0_0_20px_-6px_oklch(0.86_0.22_150/0.6)]"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </TabsTrigger>
  );
}

/* ---------------- Monitor Tab ---------------- */

function MonitorTab({
  automation,
  setAutomation,
  stats,
  logs,
  onReset,
}: {
  automation: boolean;
  setAutomation: (v: boolean) => void;
  stats: typeof seedStats;
  logs: LogEntry[];
  onReset: () => void;
}) {

  return (
    <div className="grid gap-6">
      {/* Hero / automation toggle */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 300px at 80% 20%, oklch(0.86 0.22 150 / 0.12), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-xs font-medium text-neon">
              <CircleDot className="h-3 w-3 animate-pulse" />
              {automation ? "Engine running" : "Engine paused"}
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {automation ? "Hunting paid dev bounties — 24/7" : "Automation is off"}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              n8n + Make.com workflows continuously scan GitHub, Algora, LinkedIn and Facebook,
              score leads against your 9 GitHub projects, and dispatch personalized pitches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={onReset}
              className="border-border bg-surface text-foreground/80 hover:bg-surface-elevated"
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset numbers to 0
            </Button>
            <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-elevated px-5 py-4">
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Automation
                </div>
                <div className={`text-sm font-bold ${automation ? "text-neon" : "text-muted-foreground"}`}>
                  {automation ? "ON" : "OFF"}
                </div>
              </div>
              <Switch
                checked={automation}
                onCheckedChange={setAutomation}
                className="data-[state=checked]:bg-neon"
              />
            </div>

          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Eye}
          label="Leads Scanned"
          value={stats.scanned.toLocaleString()}
          delta="+128 today"
          tone="neon"
        />
        <MetricCard
          icon={Bot}
          label="AI Pitches Sent"
          value={stats.pitches.toString()}
          delta="+9 today"
          tone="accent"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Conversions"
          value={stats.conversions.toString()}
          delta="15.1% rate"
          tone="info"
        />
        <MetricCard
          icon={DollarSign}
          label="Total Earned"
          value={`$${stats.earned.toLocaleString()}`}
          delta="+ $2,450 this wk"
          tone="neon"
        />
      </div>

      {/* Live log */}
      <div className="glass-panel rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-neon" />
            <h3 className="text-sm font-semibold">Live event stream</h3>
            <Badge variant="outline" className="border-border bg-surface text-[10px] font-mono">
              n8n · make.com
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${automation ? "bg-neon animate-pulse" : "bg-muted-foreground"}`} />
            <span className="font-mono">{automation ? "streaming" : "paused"}</span>
          </div>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="divide-y divide-border/40 font-mono text-[12.5px]">
            {logs.map((log, i) => (
              <div
                key={`${log.t}-${i}`}
                className="flex items-start gap-3 px-5 py-2.5 transition-colors hover:bg-surface-elevated/60"
              >
                <span className="shrink-0 text-muted-foreground">[{log.t}]</span>
                <LogBadge level={log.level} />
                <span className="text-foreground/90">{log.msg}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <WebhookField />
    </div>
  );
}

function LogBadge({ level }: { level: LogEntry["level"] }) {
  const map = {
    info: { label: "INFO", cls: "text-info border-info/40 bg-info/10" },
    ok: { label: "OK", cls: "text-neon border-neon/40 bg-neon/10" },
    warn: { label: "WARN", cls: "text-warning border-warning/40 bg-warning/10" },
  } as const;
  const m = map[level];
  return (
    <span className={`shrink-0 rounded border px-1.5 text-[10px] font-bold tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  delta: string;
  tone: "neon" | "accent" | "info";
}) {
  const toneCls = {
    neon: "from-neon/20 to-transparent text-neon",
    accent: "from-accent/20 to-transparent text-accent",
    info: "from-info/20 to-transparent text-info",
  }[tone];
  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-5">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${toneCls} opacity-50 blur-2xl`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Icon className={`h-4 w-4 ${toneCls.split(" ").slice(-1)[0]}`} />
        </div>
        <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3 text-neon" />
          {delta}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Portfolio Tab ---------------- */

function PortfolioTab() {
  const [name, setName] = usePersistedState("profile.name", developerProfile.name);
  const [role, setRole] = usePersistedState("profile.role", developerProfile.role);
  const [linkedin, setLinkedin] = usePersistedState("profile.linkedin", developerProfile.linkedin);
  const [facebook, setFacebook] = usePersistedState("profile.facebook", developerProfile.facebook);
  const [stack, setStack] = usePersistedState(
    "profile.stack",
    portfolioRepos
      .map((r, i) => `${i + 1}. ${r.name} — ${r.tagline}\n   stack: ${r.stack}`)
      .join("\n"),
  );
  const [prompt, setPrompt] = usePersistedState(
    "profile.systemPrompt",
    `You are an autonomous pitcher writing on behalf of {{name}} ({{role}}).

Voice:
- Direct, polite, confident. No fluff. No emojis.
- Max 110 words.

Rules:
- Open with the SPECIFIC pain in the post (one sentence).

- Then map ONE relevant GitHub repo from the portfolio to the problem (use repo name).
- Propose concrete deliverable + realistic timeline.
- State a fixed price anchored to the listed budget.
- Close with a single low-friction question (e.g. "Want me to start?").

Never invent credentials. Never overpromise. Never copy boilerplate.`,
  );

  const handleSave = () => {
    toast.success("Portfolio & system prompt saved", {
      description: "AI pitcher will use this context on the next generation.",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard
        icon={Settings2}
        title="Developer profile"
        subtitle="Used to personalize every AI pitch."
      >
        <div className="grid gap-4">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Role / headline">
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
          <Field label="LinkedIn URL">
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
          </Field>
          <Field label="Facebook URL">
            <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} />
          </Field>
          <Field label="GitHub repositories & tech stack (9 active projects)">
            <Textarea
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              rows={11}
              className="resize-none font-mono text-xs"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        icon={Sparkles}
        title="System prompt"
        subtitle="How the AI writes pitches. Keep it personalized, polite, and on-topic."
        right={
          <Badge variant="outline" className="border-neon/30 bg-neon/10 text-neon">
            gpt-4o · custom
          </Badge>
        }
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={20}
          className="resize-none font-mono text-xs leading-relaxed"
        />
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Tokens: <span className="font-mono text-foreground">~{Math.round(prompt.length / 4)}</span>
          </p>
          <Button onClick={handleSave} className="bg-neon text-neon-foreground hover:bg-neon/90">
            <Zap className="mr-2 h-4 w-4" /> Save context
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  right,
  children,
}: {
  icon: typeof Settings2;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-neon/10 text-neon">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ---------------- Inbox Tab ---------------- */

function InboxTab({
  leads,
  selected,
  setSelectedId,
  autoPilot,
  setAutoPilot,
  onSend,
  onPitchChange,
}: {
  leads: Lead[];
  selected: Lead;
  setSelectedId: (id: string) => void;
  autoPilot: boolean;
  setAutoPilot: (v: boolean) => void;
  onSend: (lead: Lead) => void;
  onPitchChange: (id: string, pitch: string) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      {/* Lead list */}
      <div className="glass-panel flex flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-neon" />
            <h3 className="text-sm font-semibold">Inbox</h3>
            <Badge variant="outline" className="border-border bg-surface text-[10px]">
              {leads.length} leads
            </Badge>
          </div>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter
          </Button>
        </div>

        <div className="flex items-center justify-between border-b border-border/60 bg-surface/40 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles className={`h-3.5 w-3.5 ${autoPilot ? "text-neon" : "text-muted-foreground"}`} />
            <span className="font-medium">Auto-pilot</span>
            <span className="text-muted-foreground">
              {autoPilot ? "instant dispatch" : "manual review"}
            </span>
          </div>
          <Switch
            checked={autoPilot}
            onCheckedChange={(v) => {
              setAutoPilot(v);
              if (v) toast("Auto-pilot ON", { description: "Pitches dispatch instantly via webhook." });
            }}
            className="data-[state=checked]:bg-neon"
          />
        </div>

        <ScrollArea className="h-[640px]">
          <ul className="divide-y divide-border/40">
            {leads.map((lead) => {
              const Icon = SOURCE_ICONS[lead.source];
              const active = lead.id === selected.id;
              return (
                <li key={lead.id}>
                  <button
                    onClick={() => setSelectedId(lead.id)}
                    className={`group flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                      active ? "bg-neon/8" : "hover:bg-surface-elevated/60"
                    }`}
                  >
                    {active && <span className="absolute left-0 h-12 w-0.5 bg-neon" />}
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {lead.source}
                        </span>
                        <span className="text-[10px] text-muted-foreground">· {lead.postedAt}</span>
                        {lead.status === "pitched" && (
                          <Badge variant="outline" className="ml-auto border-neon/30 bg-neon/10 px-1.5 py-0 text-[9px] text-neon">
                            sent
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                        {lead.title}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="rounded border border-neon/30 bg-neon/10 px-1.5 py-0.5 text-[10px] font-bold text-neon">
                          ${lead.budget.toLocaleString()}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${URGENCY_STYLES[lead.urgency]}`}
                        >
                          {lead.urgency}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </div>

      {/* Detail */}
      <div className="glass-panel flex flex-col overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = SOURCE_ICONS[selected.source];
                return <Icon className="h-4 w-4 text-muted-foreground" />;
              })()}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {selected.source}
              </span>
              <span className="text-xs text-muted-foreground">· posted {selected.postedAt}</span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight">{selected.title}</h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-neon/30 bg-neon/10 px-2 py-0.5 text-xs font-bold text-neon">
                <DollarSign className="h-3 w-3" />
                {selected.budget.toLocaleString()}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${URGENCY_STYLES[selected.urgency]}`}
              >
                <Flame className="h-3 w-3" />
                {selected.urgency} urgency
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Original post
            </div>
            <div className="rounded-xl border border-border bg-surface/60 p-4 text-sm leading-relaxed text-foreground/90">
              {selected.description}
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neon">
                <Sparkles className="h-3.5 w-3.5" /> AI generated pitch
              </div>
              <Badge variant="outline" className="border-neon/30 bg-neon/10 text-[10px] text-neon">
                matched repo · personalized
              </Badge>
            </div>
            <Textarea
              value={selected.pitch}
              onChange={(e) => onPitchChange(selected.id, e.target.value)}
              rows={8}
              className="resize-none rounded-xl border-neon/20 bg-surface/60 text-sm leading-relaxed focus-visible:ring-neon/40"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Webhook className="h-3.5 w-3.5" />
              Webhook target: <span className="font-mono text-foreground">n8n.lovable/dispatch</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Sparkles className="mr-2 h-4 w-4" /> Regenerate
              </Button>
              <Button
                onClick={() => onSend(selected)}
                className="bg-neon text-neon-foreground neon-glow hover:bg-neon/90"
              >
                {autoPilot ? (
                  <>
                    <Zap className="mr-2 h-4 w-4" /> Dispatch now
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Send pitch
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Payouts Tab ---------------- */

function PayoutsTab({ stats }: { stats: typeof seedStats }) {
  const payouts = [
    { date: "Jun 26", client: "Algora · ld_998", amount: 1200, status: "Paid" },
    { date: "Jun 24", client: "YC startup · billing kit", amount: 3200, status: "Paid" },
    { date: "Jun 21", client: "Shopify perf audit", amount: 600, status: "Paid" },
    { date: "Jun 18", client: "GitHub bounty · WS fix", amount: 850, status: "Paid" },
    { date: "Jun 15", client: "Resume parser API", amount: 1800, status: "Paid" },
    { date: "Jun 10", client: "Next.js migration", amount: 1400, status: "Paid" },
  ];

  const integrations = [
    { name: "Make.com / n8n webhook", icon: Webhook, status: "Connected", detail: "12 workflows · 99.8% uptime" },
    { name: "GitHub API", icon: Github, status: "Connected", detail: "OAuth · 4 scopes" },
    { name: "LinkedIn API", icon: Linkedin, status: "Connected", detail: "Sales Nav · rotating proxy" },
    { name: "Facebook API", icon: Facebook, status: "Connected", detail: "Graph v18 · groups read" },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={DollarSign} label="Total earned" value={`$${stats.earned.toLocaleString()}`} delta="all-time" tone="neon" />
        <MetricCard icon={TrendingUp} label="This month" value="$9,050" delta="+38% vs last" tone="accent" />
        <MetricCard icon={CheckCircle2} label="Avg ticket" value="$1,677" delta="11 deals" tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-panel rounded-2xl">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <h3 className="text-sm font-semibold">Recent payouts</h3>
            <Badge variant="outline" className="border-neon/30 bg-neon/10 text-[10px] text-neon">
              Stripe · auto-reconciled
            </Badge>
          </div>
          <div className="divide-y divide-border/40">
            {payouts.map((p) => (
              <div key={p.client} className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-4 px-6 py-3.5 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{p.date}</span>
                <span className="truncate font-medium">{p.client}</span>
                <span className="font-mono font-bold text-neon">+${p.amount.toLocaleString()}</span>
                <Badge variant="outline" className="border-neon/30 bg-neon/10 text-[10px] text-neon">
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <h3 className="text-sm font-semibold">Integrations</h3>
            <span className="flex items-center gap-1.5 text-xs text-neon">
              <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse" />
              4 / 4 healthy
            </span>
          </div>
          <ul className="divide-y divide-border/40">
            {integrations.map((it) => (
              <li key={it.name} className="flex items-center gap-3 px-6 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface">
                  <it.icon className="h-4.5 w-4.5 text-foreground/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{it.name}</div>
                  <div className="text-xs text-muted-foreground">{it.detail}</div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/30 bg-neon/10 px-2.5 py-0.5 text-[11px] font-semibold text-neon">
                  <Plug className="h-3 w-3" />
                  {it.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <WebhookField />
    </div>
  );
}

/* ---------------- Webhook Field ---------------- */

function WebhookField() {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_WEBHOOK_URL);
      setCopied(true);
      toast.success("Webhook URL copied", {
        description: "Paste it into your n8n / Make.com HTTP node.",
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed — select & copy manually.");
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-neon/10 text-neon">
            <Webhook className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Incoming lead webhook</h3>
            <p className="text-xs text-muted-foreground">
              Point your n8n / Make.com scenarios at this endpoint to push leads into the engine.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-neon/30 bg-neon/10 text-[10px] text-neon">
          POST · JSON · live
        </Badge>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-neon/30 bg-surface/60 p-1.5 pl-3">
        <span className="font-mono text-[11px] font-bold text-neon">POST</span>
        <Input
          readOnly
          value={MOCK_WEBHOOK_URL}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 border-0 bg-transparent font-mono text-sm text-foreground/90 focus-visible:ring-0"
        />
        <Button
          size="sm"
          onClick={handleCopy}
          className="h-9 shrink-0 bg-neon text-neon-foreground hover:bg-neon/90"
        >
          {copied ? (
            <>
              <Check className="mr-1.5 h-4 w-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" /> Copy
            </>
          )}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Auth: <span className="font-mono text-foreground/80">Bearer ${"{"}LOVABLE_INGEST_KEY{"}"}</span></span>
        <span>Expects: <span className="font-mono text-foreground/80">{`{ source, title, budget, description }`}</span></span>
        <span className="inline-flex items-center gap-1 text-neon">
          <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse" /> endpoint healthy
        </span>
      </div>
    </div>
  );
}

/* ---------------- AI Marketing Bot Tab ---------------- */

function MarketingBotTab() {
  const run = useServerFn(generateMarketingPlan);
  const [facebook, setFacebook] = usePersistedState("bot.facebook", developerProfile.facebook);
  const [linkedin, setLinkedin] = usePersistedState("bot.linkedin", developerProfile.linkedin);
  const [fiverr, setFiverr] = usePersistedState("bot.fiverr", "https://www.fiverr.com/");
  const [github, setGithub] = usePersistedState("bot.github", "https://github.com/bahdan-los");
  const [other, setOther] = usePersistedState("bot.other", "");
  const [goals, setGoals] = usePersistedState(
    "bot.goals",
    "Land 3–5 paid web-dev / AI-automation gigs in the next 14 days. Target $300–$1500 per project. Build inbound flow from LinkedIn + Fiverr.",
  );
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = usePersistedState<MarketingPlan | null>("bot.plan", null);
  const [planGeneratedAt, setPlanGeneratedAt] = usePersistedState<string | null>("bot.planGeneratedAt", null);
  const [error, setError] = useState<string | null>(null);


  const portfolioText = useMemo(
    () =>
      portfolioRepos
        .map((r) => `• ${r.name} — ${r.tagline} (${r.stack})`)
        .join("\n"),
    [],
  );

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await run({
        data: {
          profileLinks: { facebook, linkedin, fiverr, github, other },
          goals,
          portfolio: portfolioText,
        },
      });
      setPlan(res.plan);
      setPlanGeneratedAt(new Date().toISOString());
      toast.success("Plan generated & saved", {
        description: "Your plan is remembered — close the tab and come back any time.",
      });

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      toast.error("AI bot failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="glass-panel relative overflow-hidden rounded-2xl p-6 md:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 300px at 80% 20%, oklch(0.86 0.22 150 / 0.12), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-xs font-medium text-neon">
              <BrainCircuit className="h-3 w-3" />
              Autonomous marketing strategist
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Drop your profile links — I'll do the marketing for you.
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The bot audits your FB / LinkedIn / Fiverr / GitHub presence, writes ready-to-post
              copy, builds a 7-day action plan and projects expected income (low / high).
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-neon text-neon-foreground neon-glow hover:bg-neon/90"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> {plan ? "Regenerate plan" : "Generate full plan"}
                </>
              )}
            </Button>
            {planGeneratedAt && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Save className="h-3 w-3 text-neon" />
                <span>
                  Saved locally · last run{" "}
                  <span className="font-mono text-foreground/80">
                    {new Date(planGeneratedAt).toLocaleString()}
                  </span>
                </span>
              </div>
            )}
            {plan && (
              <button
                type="button"
                onClick={() => {
                  setPlan(null);
                  setPlanGeneratedAt(null);
                  clearPersisted("bot.plan");
                  clearPersisted("bot.planGeneratedAt");
                  toast("Saved plan cleared");
                }}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear saved plan
              </button>
            )}
          </div>

        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <SectionCard icon={Target} title="Profile links to analyze" subtitle="Paste every public profile the bot should audit.">
          <div className="grid gap-3">
            <Field label="LinkedIn"><Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." /></Field>
            <Field label="Facebook"><Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/..." /></Field>
            <Field label="Fiverr gig / profile"><Input value={fiverr} onChange={(e) => setFiverr(e.target.value)} placeholder="https://fiverr.com/..." /></Field>
            <Field label="GitHub"><Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/..." /></Field>
            <Field label="Other (Upwork / X / IG / site)"><Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="https://..." /></Field>
            <Field label="Goals for the bot">
              <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={4} className="resize-none text-sm" />
            </Field>
          </div>
        </SectionCard>

        <div className="grid gap-6">
          {error && (
            <div className="glass-panel rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
              {error}
            </div>
          )}

          {!plan && !error && (
            <div className="glass-panel grid place-items-center rounded-2xl p-12 text-center">
              <BrainCircuit className="mb-3 h-10 w-10 text-neon/60" />
              <h3 className="text-lg font-semibold">No plan generated yet</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Fill the links on the left and hit <span className="text-neon">Generate full plan</span> —
                the AI will return a 7-day action schedule, ready-to-publish post drafts, and a real income forecast.
              </p>
            </div>
          )}

          {plan && (
            <>
              {plan.summary && (
                <SectionCard icon={Sparkles} title="Executive summary">
                  <p className="text-sm leading-relaxed text-foreground/90">{plan.summary}</p>
                </SectionCard>
              )}

              {plan.income_forecast && (
                <SectionCard icon={LineChart} title="Income forecast (USD)" subtitle="Low / high range — assumes you execute the daily actions.">
                  <div className="grid grid-cols-3 gap-3">
                    <ForecastCell label="Week 1" low={plan.income_forecast.week_1_low_usd} high={plan.income_forecast.week_1_high_usd} />
                    <ForecastCell label="Month 1" low={plan.income_forecast.month_1_low_usd} high={plan.income_forecast.month_1_high_usd} />
                    <ForecastCell label="Quarter 1" low={plan.income_forecast.quarter_1_low_usd} high={plan.income_forecast.quarter_1_high_usd} />
                  </div>
                  {!!plan.income_forecast.assumptions?.length && (
                    <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                      {plan.income_forecast.assumptions.map((a, i) => (
                        <li key={i}>• {a}</li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              )}

              {!!plan.profile_audit?.length && (
                <SectionCard icon={Target} title="Profile audit">
                  <ChatLauncher
                    plan={plan}
                    profile={{
                      name: developerProfile.name,
                      role: developerProfile.role,
                      links: { facebook, linkedin, fiverr, github, other },
                      portfolio: portfolioText,
                      goals,
                    }}
                  />
                  <div className="mt-4 grid gap-3">
                    {plan.profile_audit.map((a, i) => (
                      <div key={i} className="rounded-xl border border-border bg-surface/60 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-semibold">{a.platform}</div>
                          {typeof a.score === "number" && (
                            <Badge variant="outline" className="border-neon/30 bg-neon/10 text-neon">
                              {a.score}/100
                            </Badge>
                          )}
                        </div>
                        {a.url && <div className="mb-2 truncate font-mono text-[11px] text-muted-foreground">{a.url}</div>}
                        <BulletList title="Strengths" items={a.strengths} tone="ok" />
                        <BulletList title="Weaknesses" items={a.weaknesses} tone="warn" />
                        <BulletList title="Fix now" items={a.fix_now} tone="neon" />
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {!!plan.daily_actions?.length && (
                <SectionCard icon={CalendarClock} title="Your 7-day action plan" subtitle="Exactly what to do and when.">
                  <div className="grid gap-3">
                    {plan.daily_actions.map((d, i) => (
                      <div key={i} className="rounded-xl border border-border bg-surface/60 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-neon">{d.day}</span>
                          <span className="text-xs text-muted-foreground">{d.focus}</span>
                        </div>
                        <ul className="space-y-1.5">
                          {d.tasks?.map((t, j) => (
                            <li key={j} className="grid grid-cols-[60px_1fr] gap-3 text-sm">
                              <span className="font-mono text-xs text-muted-foreground">{t.time}</span>
                              <div>
                                <div className="font-medium">{t.task}</div>
                                {t.why && <div className="text-xs text-muted-foreground">{t.why}</div>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {!!plan.post_drafts?.length && (
                <SectionCard icon={Sparkles} title="Ready-to-publish posts">
                  <div className="grid gap-3">
                    {plan.post_drafts.map((p, i) => (
                      <div key={i} className="rounded-xl border border-border bg-surface/60 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <Badge variant="outline" className="border-neon/30 bg-neon/10 text-neon">{p.platform}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={async () => {
                              const txt = `${p.hook}\n\n${p.body}\n\n${p.cta ?? ""}\n\n${(p.hashtags ?? []).join(" ")}`.trim();
                              await navigator.clipboard.writeText(txt);
                              toast.success("Post copied");
                            }}
                          >
                            <Copy className="mr-1.5 h-3 w-3" /> Copy
                          </Button>
                        </div>
                        {p.hook && <div className="text-sm font-semibold">{p.hook}</div>}
                        {p.body && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{p.body}</p>}
                        {p.cta && <p className="mt-2 text-sm font-medium text-neon">{p.cta}</p>}
                        {!!p.hashtags?.length && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.hashtags.map((h, j) => (
                              <span key={j} className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">{h}</span>
                            ))}
                          </div>
                        )}
                        {p.image_prompt && (
                          <div className="mt-2 rounded border border-dashed border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground/80">Image prompt:</span> {p.image_prompt}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {!!plan.next_milestones?.length && (
                <SectionCard icon={Target} title="Next milestones & expected income">
                  <ul className="divide-y divide-border/40">
                    {plan.next_milestones.map((m, i) => (
                      <li key={i} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 py-2.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{m.when}</span>
                        <span>{m.milestone}</span>
                        {typeof m.expected_usd === "number" && (
                          <span className="font-mono font-bold text-neon">+${m.expected_usd.toLocaleString()}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}
            </>
          )}

          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-neon/10 text-neon">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">Lead inquiries are emailed to</div>
                <div className="truncate font-mono text-xs text-neon">{NOTIFY_EMAIL}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForecastCell({ label, low, high }: { label: string; low?: number; high?: number }) {
  return (
    <div className="rounded-xl border border-neon/20 bg-surface/60 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold text-neon">
        ${(low ?? 0).toLocaleString()} – ${(high ?? 0).toLocaleString()}
      </div>
    </div>
  );
}

function BulletList({ title, items, tone }: { title: string; items?: string[]; tone: "ok" | "warn" | "neon" }) {
  if (!items?.length) return null;
  const cls = tone === "ok" ? "text-neon" : tone === "warn" ? "text-warning" : "text-accent";
  return (
    <div className="mt-2">
      <div className={`text-[10px] font-bold uppercase tracking-wider ${cls}`}>{title}</div>
      <ul className="mt-1 space-y-0.5 text-xs text-foreground/85">
        {items.map((s, i) => (
          <li key={i}>• {s}</li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- AI Chat Launcher (Profile audit) ---------------- */

type ChatMsg = { role: "user" | "assistant"; content: string };

function ChatLauncher({
  plan,
  profile,
}: {
  plan: MarketingPlan;
  profile: {
    name: string;
    role: string;
    links: Record<string, string>;
    portfolio: string;
    goals: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const send = useServerFn(chatWithMarketingBot);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm your marketing coach. I have your full plan in context. Ask me anything (e.g. *\"walk me through Day 1 step by step\"*, *\"write the first LinkedIn post for me\"*, *\"what should I do RIGHT NOW?\"*).\n\nWhat's the very first thing you want to tackle?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await send({
        data: {
          messages: next,
          plan: plan as unknown,
          profile,
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.text }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "What should I do RIGHT NOW (next 60 min)?",
    "Walk me through Day 1 step by step.",
    "Write the first LinkedIn post for me.",
    "Which lead/profile fix has the highest ROI?",
  ];

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-8 bg-neon text-neon-foreground hover:bg-neon/90"
      >
        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
        {open ? "Hide AI Coach" : "Ask AI Coach"}
      </Button>

      {open && (
        <div className="col-span-full mt-4 overflow-hidden rounded-xl border border-neon/30 bg-surface/70">
          <div className="flex items-center justify-between border-b border-border/60 bg-surface/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-neon/15 text-neon">
                <BrainCircuit className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">AI Marketing Coach</div>
                <div className="text-[11px] text-muted-foreground">Has your full plan + profile in context</div>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="max-h-[420px] space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-neon text-neon-foreground"
                      : "border border-border/60 bg-surface text-foreground/95"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-neon" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-surface/60 px-4 py-2">
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => ask(q)}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-foreground/80 transition hover:border-neon/40 hover:text-neon disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 border-t border-border/60 p-3"
          >
            <Input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your plan, next steps, posts, income…"
              disabled={loading}
              className="h-10 flex-1 bg-surface/60 text-sm"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-10 bg-neon text-neon-foreground hover:bg-neon/90"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

