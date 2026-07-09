import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePitchGovernance, requestGeneration, refundGeneration, DAILY_PITCH_LIMIT } from "@/lib/pitch-governance";
import {
  listLeadsFn,
  updateLeadStatusFn,
  createLeadFn,
  quickIngestFn,
  requestProposalFn,
  listPortfolioFn,
  addPortfolioFn,
  updatePortfolioFn,
  deletePortfolioFn,
  getScraperConfigFn,
  saveScraperConfigFn,
  triggerGlobalScrapeFn,
  testN8nWebhookFn,
  LEAD_STATUSES,
  LEAD_INTENTS,
  GEO_TARGETS,
  type LeadStatus,
  type LeadIntent,
  type GeoTarget,

} from "@/lib/dashboard.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Inbox, Briefcase, Send, Plus, Trash2, Sparkles, ChevronDown, ChevronUp,
  Radio, Zap, RefreshCw, Copy, Check, MessageCircle, Settings2, X, Pencil, Save,
  Layers, ClipboardList, Rocket, Trophy, ShieldCheck, ShieldAlert, AlertTriangle, Loader2, PlayCircle, Clock, Ban,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/* ---------- Client-side raw-data parser ---------- */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g;
const HANDLE_RE = /(?:^|[\s(])@([a-zA-Z0-9_.]{2,30})/g;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
export type ParsedContacts = {
  emails: string[]; phones: string[]; handles: string[]; urls: string[];
};
export function parseRawContacts(text: string): ParsedContacts {
  const emails = Array.from(new Set(text.match(EMAIL_RE) ?? []));
  const phones = Array.from(new Set((text.match(PHONE_RE) ?? []).map((s) => s.trim()).filter((s) => s.replace(/\D/g, "").length >= 7)));
  const handles = Array.from(new Set(Array.from(text.matchAll(HANDLE_RE)).map((m) => `@${m[1]}`)));
  const urls = Array.from(new Set(text.match(URL_RE) ?? []));
  return { emails, phones, handles, urls };
}
function pickPrimaryContact(p: ParsedContacts, fallback: string): string {
  return p.emails[0] ?? p.phones[0] ?? p.urls[0] ?? p.handles[0] ?? fallback;
}

/* ---------- Processing status stepper ---------- */
const PROCESSING_STEPS = [
  { key: "scraping_profile",  label: "Scraping" },
  { key: "validating_contact", label: "Validating" },
  { key: "generating_pitch",  label: "Generating" },
  { key: "success",           label: "Success" },
] as const;
type ProcStep = typeof PROCESSING_STEPS[number]["key"] | "failed" | null | undefined;

function ProcessingStepper({ status }: { status: ProcStep }) {
  if (!status) return null;
  const failed = status === "failed";
  const idx = failed ? -1 : PROCESSING_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-[11px]">
      {failed ? (
        <span className="flex items-center gap-1 text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5" /> n8n reported failure
        </span>
      ) : (
        PROCESSING_STEPS.map((s, i) => {
          const done = i < idx || status === "success";
          const active = i === idx && status !== "success";
          return (
            <span key={s.key} className="flex items-center gap-1">
              {active ? <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                : done ? <Check className="h-3 w-3 text-emerald-400" />
                : <span className="h-2 w-2 rounded-full border border-border/60" />}
              <span className={active ? "text-amber-300" : done ? "text-emerald-300" : "text-muted-foreground"}>{s.label}</span>
              {i < PROCESSING_STEPS.length - 1 && <span className="opacity-40 mx-0.5">·</span>}
            </span>
          );
        })
      )}
    </div>
  );
}

/* ---------- Validation badge ---------- */
function ValidationBadge({ contact, description, status }: { contact: string | null; description: string | null; status?: string | null }) {
  const missingContact = !contact || contact.trim().length < 4;
  const shortDesc = (description ?? "").trim().length < 30;
  const invalid = status === "invalid" || missingContact || shortDesc;
  const verified = status === "verified" && !missingContact && !shortDesc;
  const validating = status === "validating";
  if (validating) {
    return <span className="text-[10px] inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 px-1.5 py-0.5">
      <Loader2 className="h-3 w-3 animate-spin" /> Validating
    </span>;
  }
  if (invalid) {
    return <span title={missingContact ? "No valid contact" : shortDesc ? "Description < 30 chars" : "Marked invalid"}
      className="text-[10px] inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 text-rose-300 px-1.5 py-0.5">
      <ShieldAlert className="h-3 w-3" /> {missingContact ? "No contact" : shortDesc ? "Thin data" : "Invalid"}
    </span>;
  }
  if (verified) {
    return <span className="text-[10px] inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5">
      <ShieldCheck className="h-3 w-3" /> Verified
    </span>;
  }
  return null;
}


const leadsQO = () =>
  queryOptions({ queryKey: ["dash", "leads"], queryFn: () => listLeadsFn(), refetchInterval: 15000 });
const portfolioQO = () =>
  queryOptions({ queryKey: ["dash", "portfolio"], queryFn: () => listPortfolioFn() });
const scraperQO = () =>
  queryOptions({ queryKey: ["dash", "scraper"], queryFn: () => getScraperConfigFn() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Lead Dashboard · Bounty Hunter" },
      { name: "description", content: "Manage incoming leads, AI pitches, and your portfolio." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(leadsQO());
    context.queryClient.ensureQueryData(portfolioQO());
    context.queryClient.ensureQueryData(scraperQO());
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-red-400">Dashboard error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: DashboardPage,
});

function DashboardUserMenu() {
  const nav = useRouter().navigate;
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (!data.user) return;
      const { data: adm } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      setIsAdmin(Boolean(adm));
    });
  }, []);
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }
  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Button asChild variant="outline" size="sm">
          <Link to="/admin"><ShieldCheck className="h-4 w-4 mr-2" /> Admin room</Link>
        </Button>
      )}
      <div className="hidden md:block text-xs text-muted-foreground max-w-[160px] truncate">{email}</div>
      <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Lead Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Ingest leads · AI pitches · portfolio · scraper controls. Every insert fires your n8n webhook.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GovernanceBadge />
            <DashboardUserMenu />
          </div>
        </header>


        <MetricsBar />
        <QuickIngest />

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList className="grid grid-cols-3 max-w-xl">
            <TabsTrigger value="leads"><Inbox className="h-4 w-4 mr-2" />Leads</TabsTrigger>
            <TabsTrigger value="portfolio"><Briefcase className="h-4 w-4 mr-2" />Portfolio</TabsTrigger>
            <TabsTrigger value="scraper"><Settings2 className="h-4 w-4 mr-2" />Scraper</TabsTrigger>
          </TabsList>
          <TabsContent value="leads"><LeadsPanel /></TabsContent>
          <TabsContent value="portfolio"><PortfolioPanel /></TabsContent>
          <TabsContent value="scraper"><ScraperPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ---------------- Governance badge ---------------- */

function GovernanceBadge() {
  const g = usePitchGovernance();
  const pct = Math.min(100, (g.used / g.limit) * 100);
  const tone = g.capReached
    ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
    : g.used >= g.limit * 0.8
      ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  const secs = Math.ceil(g.cooldownRemainingMs / 1000);
  return (
    <div
      title={
        g.capReached
          ? "Daily compliant outreach limit reached to prevent automated spamming."
          : g.cooldownActive
            ? `Anti-bulk cooldown active — next generation in ${secs}s`
            : `Daily Outreach Budget: ${g.used} / ${g.limit} used (rolling 24h)`
      }
      className={`min-w-[220px] rounded-lg border px-3 py-2 ${tone}`}
    >
      <div className="flex items-center gap-2 text-xs">
        {g.capReached ? <Ban className="h-3.5 w-3.5" />
          : g.cooldownActive ? <Clock className="h-3.5 w-3.5 animate-pulse" />
          : <ShieldCheck className="h-3.5 w-3.5" />}
        <span className="font-medium uppercase tracking-wide">Daily Outreach Budget</span>
        <span className="ml-auto tabular-nums font-mono">
          {g.used} / {g.limit}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background/60">
        <div
          className={`h-full transition-all ${g.capReached ? "bg-rose-500" : g.used >= g.limit * 0.8 ? "bg-amber-400" : "bg-emerald-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {g.cooldownActive && !g.capReached && (
        <div className="mt-1 text-[10px] text-amber-300/90 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Cooling down · {secs}s
        </div>
      )}
      {g.capReached && (
        <div className="mt-1 text-[10px] text-rose-300/90">Limit reached · resets rolling 24h</div>
      )}
    </div>
  );
}

/* ---------------- Metrics ---------------- */

function MetricsBar() {
  const { data: leads } = useSuspenseQuery(leadsQO());
  const total = leads.length;
  const pendingAi = leads.filter((l) => l.status === "pending" || l.status === "generating").length;
  const ready = leads.filter((l) => Boolean(l.business_proposal) || l.status === "ready").length;
  const sent = leads.filter((l) => l.status === "sent" || l.status === "pitched").length;
  const won = leads.filter((l) => l.status === "won" || l.status === "closed").length;

  const items = [
    { label: "Total Leads", value: total, icon: Layers, color: "text-primary" },
    { label: "Pending AI", value: pendingAi, icon: ClipboardList, color: "text-amber-400" },
    { label: "Proposals Ready", value: ready, icon: Zap, color: "text-yellow-400" },
    { label: "Sent", value: sent, icon: Rocket, color: "text-sky-400" },
    { label: "Won / Closed", value: won, icon: Trophy, color: "text-emerald-400" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((m) => (
        <div key={m.label} className="rounded-lg border border-border/60 bg-card/50 p-3 flex items-center gap-3">
          <m.icon className={`h-5 w-5 ${m.color}`} />
          <div>
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-xl font-semibold tabular-nums">{m.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Quick ingest ---------------- */

function QuickIngest() {
  const qc = useQueryClient();
  const ingest = useServerFn(quickIngestFn);
  const [value, setValue] = useState("");
  const parsed = useMemo(() => parseRawContacts(value), [value]);
  const hasParsed = parsed.emails.length + parsed.phones.length + parsed.handles.length + parsed.urls.length > 0;

  const mut = useMutation({
    mutationFn: (input: string) => {
      const p = parseRawContacts(input);
      const contact = pickPrimaryContact(p, "");
      const raw_social_data = hasParsedContacts(p) ? { parsed: p, ingested_at: new Date().toISOString() } : null;
      return ingest({ data: { input, contact: contact || null, raw_social_data } });
    },
    onSuccess: () => {
      setValue("");
      qc.invalidateQueries({ queryKey: ["dash", "leads"] });
    },
  });

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Sparkles className="h-5 w-5 text-primary shrink-0 hidden sm:block" />
          <Textarea
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste a URL, raw social post, or job dump — emails/phones/handles auto-extract before saving"
            className="min-h-[42px] resize-none bg-background/60"
          />
          <Button
            disabled={!value.trim() || mut.isPending}
            onClick={() => mut.mutate(value)}
            className="bg-gradient-to-r from-primary to-accent shrink-0"
          >
            {mut.isPending ? "Ingesting…" : "Ingest → n8n"}
          </Button>
        </div>
        {hasParsed && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {parsed.emails.map((e) => <ContactChip key={e} label={e} color="emerald" />)}
            {parsed.phones.map((p) => <ContactChip key={p} label={p} color="sky" />)}
            {parsed.handles.map((h) => <ContactChip key={h} label={h} color="violet" />)}
            {parsed.urls.map((u) => <ContactChip key={u} label={u.length > 40 ? u.slice(0, 40) + "…" : u} color="amber" />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function hasParsedContacts(p: ParsedContacts) {
  return p.emails.length + p.phones.length + p.handles.length + p.urls.length > 0;
}

function ContactChip({ label, color }: { label: string; color: "emerald" | "sky" | "violet" | "amber" }) {
  const map = {
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    violet: "border-violet-500/40 bg-violet-500/10 text-violet-300",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  } as const;
  return <span className={`rounded-full border px-2 py-0.5 ${map[color]}`}>{label}</span>;
}


/* ---------------- Leads ---------------- */

const STATUS_STYLES: Record<LeadStatus, string> = {
  pending: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  generating: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  ready: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  pitched: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  sent: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  won: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  closed: "bg-emerald-600/20 text-emerald-300 border-emerald-600/40",
  lost: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  ignored: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
};

function LiveSyncBar({ count, updatedAt, refetching, onRefresh }: { count: number; updatedAt: number; refetching: boolean; onRefresh: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const secs = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs" data-tick={tick}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>
      <Radio className="h-3.5 w-3.5 text-emerald-400" />
      <span className="font-medium text-foreground">Live Sync</span>
      <span className="text-muted-foreground">· {count} rows in Supabase</span>
      <span className="text-muted-foreground">· updated {secs}s ago</span>
      <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={onRefresh} disabled={refetching}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refetching ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}

function LeadsPanel() {
  const qc = useQueryClient();
  const query = useSuspenseQuery(leadsQO());
  const leads = query.data;
  const createLead = useServerFn(createLeadFn);
  const updateStatus = useServerFn(updateLeadStatusFn);
  const requestProposal = useServerFn(requestProposalFn);

  const [selectedId, setSelectedId] = useState<string | null>(leads[0]?.id ?? null);
  const [expandedProposal, setExpandedProposal] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ title: "", description: "", source: "manual", contact: "", ai_pitch: "" });
  const [copied, setCopied] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (v: typeof form) => createLead({ data: v }),
    onSuccess: () => {
      setForm({ title: "", description: "", source: "manual", contact: "", ai_pitch: "" });
      qc.invalidateQueries({ queryKey: ["dash", "leads"] });
    },
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: LeadStatus }) => updateStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dash", "leads"] }),
  });

  const gov = usePitchGovernance();
  const proposalMut = useMutation({
    mutationFn: async (id: string) => {
      const gate = requestGeneration();
      if (!gate.ok) {
        if (gate.reason === "cap") {
          toast.error("Daily compliant outreach limit reached to prevent automated spamming.", {
            description: `${DAILY_PITCH_LIMIT}/${DAILY_PITCH_LIMIT} generations used in the last 24h.`,
          });
        } else {
          toast.warning("Anti-bulk cooldown active", {
            description: "Please process leads intentionally, one by one (10s throttle).",
          });
        }
        throw new Error(gate.reason ?? "blocked");
      }
      const res = await requestProposal({ data: { id } });
      if (res && (res as { skipped?: boolean }).skipped) {
        refundGeneration();
        toast.info("A compliant pitch already exists for this contact. Duplicate prevention active.");
      }
      return res;
    },
    onSuccess: (r, id) => {
      if (r && (r as { skipped?: boolean }).skipped) return;
      setExpandedProposal((s) => ({ ...s, [id]: true }));
      qc.invalidateQueries({ queryKey: ["dash", "leads"] });
    },
  });

  // Realtime: refetch leads whenever Supabase pushes any change (n8n writeback).
  useEffect(() => {
    const channel = supabase
      .channel("leads-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        qc.invalidateQueries({ queryKey: ["dash", "leads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const selected = leads.find((l) => l.id === selectedId) ?? leads[0];

  const copyPitch = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch { /* noop */ }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center gap-2">
        <Inbox className="h-5 w-5 text-primary" />
        <CardTitle>Leads Inbox</CardTitle>
        <Badge variant="secondary" className="ml-auto">{leads.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <LiveSyncBar
          count={leads.length}
          updatedAt={query.dataUpdatedAt}
          refetching={query.isFetching}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["dash", "leads"] })}
        />

        <details className="rounded-lg border border-border/60 bg-muted/30">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">Manual lead (advanced)</summary>
          <form
            className="grid gap-2 p-3 pt-0"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) return;
              createMut.mutate(form);
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Lead title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <Textarea rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              <Input placeholder="AI pitch (optional)" value={form.ai_pitch} onChange={(e) => setForm({ ...form, ai_pitch: e.target.value })} />
            </div>
            <Button type="submit" size="sm" disabled={createMut.isPending} className="justify-self-start">
              <Plus className="h-4 w-4 mr-1" />
              {createMut.isPending ? "Adding…" : "Add lead + trigger n8n"}
            </Button>
          </form>
        </details>

        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leads yet. Paste something into the quick ingest above.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <ul className="space-y-1 max-h-[560px] overflow-auto pr-1">
              {leads.map((l) => {
                const hasProposal = Boolean(l.business_proposal);
                const st = (l.status ?? "pending") as LeadStatus;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => setSelectedId(l.id)}
                      className={`w-full text-left rounded-md px-3 py-2 text-sm transition ${
                        selected?.id === l.id
                          ? "bg-primary/15 border border-primary/40"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {hasProposal && <Zap className="h-3 w-3 text-amber-400" />}
                        {l.title}
                      </div>
                      <div className="text-xs flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-muted-foreground">{l.source}</span>
                        <span className={`text-[10px] rounded border px-1.5 py-0.5 ${STATUS_STYLES[st] ?? ""}`}>{st}</span>
                        <ValidationBadge contact={l.contact} description={l.description} status={l.validation_status} />
                        {l.processing_status && l.processing_status !== "success" && (
                          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && (
              <div className="rounded-lg border border-border/60 bg-card/50 p-4 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{selected.title}</h3>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <ValidationBadge contact={selected.contact} description={selected.description} status={selected.validation_status} />
                    <Badge>{selected.source}</Badge>
                  </div>
                </div>
                <ProcessingStepper status={selected.processing_status as ProcStep} />
                {selected.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
                )}
                {selected.contact && (
                  <p className="text-xs text-muted-foreground break-all">
                    Contact: <span className="text-foreground">{selected.contact}</span>
                  </p>
                )}

                <StatusPipeline
                  current={(selected.status ?? "pending") as LeadStatus}
                  pending={statusMut.isPending}
                  onChange={(status) => statusMut.mutate({ id: selected.id, status })}
                />

                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Sparkles className="h-3.5 w-3.5" /> AI generated pitch
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/60 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
                    {selected.ai_pitch || <span className="text-muted-foreground">No pitch generated yet.</span>}
                  </div>
                  {selected.ai_pitch && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => copyPitch(selected.id, selected.ai_pitch!)}>
                        {copied === selected.id ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                        {copied === selected.id ? "Copied" : "Copy Pitch"}
                      </Button>
                      <QuickOpenMenu pitch={selected.ai_pitch} contact={selected.contact} />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={
                        (proposalMut.isPending && proposalMut.variables === selected.id) ||
                        !gov.canGenerate
                      }
                      onClick={() => proposalMut.mutate(selected.id)}
                      title={
                        gov.capReached
                          ? "Daily compliant outreach limit reached to prevent automated spamming."
                          : gov.cooldownActive
                            ? `Cooling down · ${Math.ceil(gov.cooldownRemainingMs / 1000)}s`
                            : undefined
                      }
                      className="bg-gradient-to-r from-primary to-accent disabled:opacity-60"
                    >
                      {gov.capReached ? <Ban className="h-3.5 w-3.5 mr-1" />
                        : gov.cooldownActive ? <Clock className="h-3.5 w-3.5 mr-1 animate-pulse" />
                        : <Zap className="h-3.5 w-3.5 mr-1" />}
                      {proposalMut.isPending && proposalMut.variables === selected.id
                        ? "Dispatching to n8n…"
                        : gov.capReached
                          ? "Daily Limit Reached"
                          : gov.cooldownActive
                            ? `Cooling down · ${Math.ceil(gov.cooldownRemainingMs / 1000)}s`
                            : selected.business_proposal
                              ? "Regenerate Pro Proposal"
                              : "Generate Pro Proposal"}
                    </Button>
                    {selected.business_proposal && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedProposal((s) => ({ ...s, [selected.id]: !s[selected.id] }))
                          }
                        >
                          {expandedProposal[selected.id] ? (
                            <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Hide proposal</>
                          ) : (
                            <><ChevronDown className="h-3.5 w-3.5 mr-1" /> View proposal</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyPitch(`${selected.id}-prop`, selected.business_proposal!)}
                        >
                          {copied === `${selected.id}-prop` ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          Copy Proposal
                        </Button>
                        <QuickOpenMenu pitch={selected.business_proposal} contact={selected.contact} />
                      </>
                    )}
                    {selected.status === "generating" && !selected.business_proposal && (
                      <span className="text-xs text-amber-400 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Waiting for n8n to write back…
                      </span>
                    )}
                  </div>

                  {expandedProposal[selected.id] && selected.business_proposal && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" /> Pro Business Proposal
                      </div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {selected.business_proposal}
                      </div>
                      {selected.raw_social_data && (
                        <details className="mt-3">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            Raw social data
                          </summary>
                          <pre className="text-[11px] mt-2 max-h-64 overflow-auto bg-background/60 p-2 rounded border border-border/40">
                            {JSON.stringify(selected.raw_social_data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusPipeline({ current, pending, onChange }: { current: LeadStatus; pending: boolean; onChange: (s: LeadStatus) => void }) {
  const pipeline: LeadStatus[] = ["pending", "generating", "ready", "sent", "won", "closed"];
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Pipeline</span>
      {pipeline.map((s, i) => {
        const active = current === s;
        return (
          <button
            key={s}
            disabled={pending || active}
            onClick={() => onChange(s)}
            className={`text-[11px] px-2 py-1 rounded border transition ${
              active ? STATUS_STYLES[s] : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            } ${pending ? "opacity-60" : ""}`}
          >
            {i > 0 && <span className="opacity-50 mr-1">›</span>}
            {s}
          </button>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 ml-auto">
            <ChevronDown className="h-3.5 w-3.5 mr-1" /> More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {LEAD_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onClick={() => onChange(s)}>
              {current === s && <Check className="h-3.5 w-3.5 mr-1" />} {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function QuickOpenMenu({ pitch, contact }: { pitch: string; contact: string | null }) {
  const encoded = encodeURIComponent(pitch.slice(0, 1500));
  const contactRaw = (contact ?? "").trim();
  const phone = contactRaw.replace(/[^\d+]/g, "");
  const isPhone = phone.length >= 6;
  const links = [
    { label: "WhatsApp", href: isPhone ? `https://wa.me/${phone.replace("+", "")}?text=${encoded}` : `https://wa.me/?text=${encoded}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encoded}&text=${encoded}` },
    { label: "FB Messenger", href: contactRaw && /facebook\.com/.test(contactRaw) ? contactRaw : `https://m.me/` },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <MessageCircle className="h-3.5 w-3.5 mr-1" /> Quick Open <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Send via</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((l) => (
          <DropdownMenuItem key={l.label} asChild>
            <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Portfolio ---------------- */

const PORTFOLIO_CATEGORIES = ["Marketing", "CRM", "Language", "Case study", "Skill", "Project", "Tool"];

function PortfolioPanel() {
  const qc = useQueryClient();
  const { data: items } = useSuspenseQuery(portfolioQO());
  const addFn = useServerFn(addPortfolioFn);
  const updFn = useServerFn(updatePortfolioFn);
  const delFn = useServerFn(deletePortfolioFn);

  const [draft, setDraft] = useState({ category: "Marketing", content: "" });
  const [filter, setFilter] = useState<string>("All");
  const [editing, setEditing] = useState<{ id: string; category: string; content: string } | null>(null);

  const addMut = useMutation({
    mutationFn: (v: typeof draft) => addFn({ data: v }),
    onSuccess: () => { setDraft({ category: draft.category, content: "" }); qc.invalidateQueries({ queryKey: ["dash", "portfolio"] }); },
  });
  const updMut = useMutation({
    mutationFn: (v: { id: string; category: string; content: string }) => updFn({ data: v }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["dash", "portfolio"] }); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dash", "portfolio"] }),
  });

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    items.forEach((i) => set.add(i.category));
    PORTFOLIO_CATEGORIES.forEach((c) => set.add(c));
    return [...set];
  }, [items]);
  const filtered = filter === "All" ? items : items.filter((i) => i.category === filter);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center gap-2">
        <Briefcase className="h-5 w-5 text-accent" />
        <CardTitle>Portfolio & Knowledge Base</CardTitle>
        <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-2 rounded-lg border border-border/60 bg-muted/30 p-3"
          onSubmit={(e) => { e.preventDefault(); if (!draft.content.trim()) return; addMut.mutate(draft); }}
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {PORTFOLIO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Textarea
              rows={2}
              placeholder="Case study, skill, or teaching method…"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={addMut.isPending} className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`text-xs px-2 py-1 rounded border transition ${
                filter === c ? "border-primary/60 bg-primary/15 text-foreground" : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c} {c !== "All" && <span className="opacity-60">({items.filter((i) => i.category === c).length})</span>}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries in this category yet.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {filtered.map((it) => {
              const isEditing = editing?.id === it.id;
              return (
                <li key={it.id} className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2">
                  {isEditing ? (
                    <>
                      <div className="flex gap-2">
                        <select
                          className="rounded-md border border-border bg-background px-2 text-sm"
                          value={editing.category}
                          onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                        >
                          {PORTFOLIO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="ml-auto flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                          <Button size="sm" disabled={updMut.isPending} onClick={() => updMut.mutate(editing)}>
                            <Save className="h-3.5 w-3.5 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                      <Textarea rows={3} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="capitalize shrink-0">{it.category}</Badge>
                        <div className="ml-auto flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing({ id: it.id, category: it.category, content: it.content })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(it.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{it.content}</p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Scraper ---------------- */

function ScraperPanel() {
  const qc = useQueryClient();
  const { data: cfg } = useSuspenseQuery(scraperQO());
  const saveFn = useServerFn(saveScraperConfigFn);

  const srcObj = (cfg.sources ?? {}) as Record<string, unknown>;
  const [sources, setSources] = useState({
    facebook: Boolean(srcObj.facebook),
    instagram: Boolean(srcObj.instagram),
    google: Boolean(srcObj.google),
    linkedin: Boolean(srcObj.linkedin),
  });
  const [keywords, setKeywords] = useState<string[]>(cfg.keywords ?? []);
  const [kwInput, setKwInput] = useState("");
  const cfgAny = cfg as unknown as {
    intents?: LeadIntent[];
    geo_target?: GeoTarget;
    max_results_per_query?: number;
    n8n_webhook_url?: string | null;
  };
  const [intents, setIntents] = useState<LeadIntent[]>(cfgAny.intents ?? ["hiring", "freelance"]);
  const [geoTarget, setGeoTarget] = useState<GeoTarget>(cfgAny.geo_target ?? "global");
  const [maxResults, setMaxResults] = useState<number>(cfgAny.max_results_per_query ?? 5);
  const [n8nUrl, setN8nUrl] = useState<string>(cfgAny.n8n_webhook_url ?? "");

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: {
      sources, keywords, intents, geo_target: geoTarget, max_results_per_query: maxResults,
      n8n_webhook_url: n8nUrl.trim() ? n8nUrl.trim() : null,
    } }),
    onSuccess: () => { toast.success("Config saved"); qc.invalidateQueries({ queryKey: ["dash", "scraper"] }); },
    onError: (e: Error) => toast.error(e.message || "Save failed"),
  });

  const testFn = useServerFn(testN8nWebhookFn);
  const testMut = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r) => r.ok ? toast.success(`n8n responded ${r.status ?? "OK"}`) : toast.error(`n8n test failed: ${r.error ?? r.status}`),
  });

  const triggerFn = useServerFn(triggerGlobalScrapeFn);
  const triggerMut = useMutation({ mutationFn: () => triggerFn() });

  const exportConfig = () => {
    const payload = { sources, keywords, intents, geo_target: geoTarget, max_results_per_query: maxResults, n8n_webhook_url: n8nUrl || null, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `scraper-config-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Config exported");
  };
  const importConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result));
        if (p.sources) setSources({ facebook: !!p.sources.facebook, instagram: !!p.sources.instagram, google: !!p.sources.google, linkedin: !!p.sources.linkedin });
        if (Array.isArray(p.keywords)) setKeywords(p.keywords.filter((k: unknown) => typeof k === "string"));
        if (Array.isArray(p.intents)) setIntents(p.intents);
        if (typeof p.geo_target === "string") setGeoTarget(p.geo_target);
        if (typeof p.max_results_per_query === "number") setMaxResults(p.max_results_per_query);
        if (typeof p.n8n_webhook_url === "string") setN8nUrl(p.n8n_webhook_url);
        toast.success("Config imported — click Save to persist");
      } catch { toast.error("Invalid config file"); }
    };
    reader.readAsText(file);
  };

  const addKw = () => {
    const v = kwInput.trim();
    if (!v) return;
    if (keywords.includes(v)) { setKwInput(""); return; }
    setKeywords([...keywords, v]);
    setKwInput("");
  };
  const removeKw = (k: string) => setKeywords(keywords.filter((x) => x !== k));

  const sourceList: Array<{ key: keyof typeof sources; label: string }> = [
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "google", label: "Google / Web" },
    { key: "linkedin", label: "LinkedIn" },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center gap-2">
        <Settings2 className="h-5 w-5 text-primary" />
        <CardTitle>Scraper & Keywords</CardTitle>
        <Badge variant="secondary" className="ml-auto">config</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="text-sm font-medium mb-2">Active sources</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {sourceList.map((s) => (
              <label key={s.key} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 cursor-pointer">
                <span className="text-sm">{s.label}</span>
                <Switch
                  checked={sources[s.key]}
                  onCheckedChange={(v) => setSources({ ...sources, [s.key]: Boolean(v) })}
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-medium mb-2">Target keywords</h4>
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Add keyword (e.g. Swedish language) and press Enter"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
            />
            <Button type="button" size="sm" onClick={addKw}><Plus className="h-4 w-4" /></Button>
          </div>
          {keywords.length === 0 ? (
            <p className="text-xs text-muted-foreground">No keywords yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="text-xs px-2 py-1 rounded-full border border-primary/40 bg-primary/10 flex items-center gap-1">
                  {k}
                  <button onClick={() => removeKw(k)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Intent & Geo Target Optimizer</h4>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Lead intent</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(LEAD_INTENTS as readonly LeadIntent[]).map((i) => {
                const active = intents.includes(i);
                const label = i === "hiring" ? "Hiring / Jobs" : i === "freelance" ? "Freelance / Contract" : "Pain Points";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIntents(active ? intents.filter((x) => x !== i) : [...intents, i])}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${active ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Geo / Platform target</label>
              <select
                value={geoTarget}
                onChange={(e) => setGeoTarget(e.target.value as GeoTarget)}
                className="mt-2 w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              >
                {(GEO_TARGETS as readonly GeoTarget[]).map((g) => (
                  <option key={g} value={g}>
                    {g === "global" ? "Global" : g === "remote" ? "Remote" : g === "thailand" ? "Local / Thailand" : g === "usa" ? "USA" : "Europe"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-between">
                <span>Max results per query</span>
                <span className="text-primary font-mono">{maxResults}</span>
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="mt-3 w-full accent-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Caps Jina AI hits per portfolio query to protect API usage.</p>
            </div>
          </div>
        </section>



        <section className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">n8n webhook</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Your personal n8n Webhook URL (POST). Leave blank to fall back to the workspace default.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://your-n8n.example.com/webhook/…"
              value={n8nUrl}
              onChange={(e) => setN8nUrl(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" disabled={testMut.isPending} onClick={() => testMut.mutate()}>
              {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Import / Export settings</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={exportConfig}>
              <Save className="h-4 w-4 mr-1" /> Export JSON
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importConfig(f); e.currentTarget.value = ""; }}
              />
              <span className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border/60 hover:bg-muted cursor-pointer">
                <Plus className="h-4 w-4" /> Import JSON
              </span>
            </label>
          </div>
        </section>





        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-medium">Master switch</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Fire an immediate <code>trigger_live_scrape</code> command to n8n using the current source & keyword config.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={triggerMut.isPending}
              onClick={() => triggerMut.mutate()}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
            >
              {triggerMut.isPending ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Dispatching…</>) : (<><PlayCircle className="h-4 w-4 mr-1" /> Trigger Global Scrape Now</>)}
            </Button>
            {triggerMut.data?.ok && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Inserted {triggerMut.data.inserted} lead{triggerMut.data.inserted === 1 ? "" : "s"} from {triggerMut.data.queries} querie{triggerMut.data.queries === 1 ? "" : "s"}</span>}
            {triggerMut.data && !triggerMut.data.ok && <span className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Scrape failed</span>}

          </div>
        </section>

        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <span className="text-xs text-muted-foreground">
            Last updated: {cfg.updated_at ? new Date(cfg.updated_at).toLocaleString() : "—"}
          </span>
          <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()} className="bg-gradient-to-r from-primary to-accent">
            {saveMut.isPending ? "Saving…" : "Save config → n8n"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Silence unused-router warning if TS gets picky in future refactors
export const _routerUnused = useRouter;
