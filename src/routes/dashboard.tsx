import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listLeadsFn,
  updateLeadStatusFn,
  createLeadFn,
  requestProposalFn,
  listPortfolioFn,
  addPortfolioFn,
  deletePortfolioFn,
} from "@/lib/dashboard.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Briefcase, Send, Plus, Trash2, Sparkles, ChevronDown, ChevronUp, Radio, Zap, RefreshCw } from "lucide-react";

const leadsQO = () =>
  queryOptions({ queryKey: ["dash", "leads"], queryFn: () => listLeadsFn(), refetchInterval: 15000 });
const portfolioQO = () =>
  queryOptions({ queryKey: ["dash", "portfolio"], queryFn: () => listPortfolioFn() });

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Lead Dashboard · Bounty Hunter" },
      { name: "description", content: "Manage incoming leads, AI pitches, and your portfolio." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(leadsQO());
    context.queryClient.ensureQueryData(portfolioQO());
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-red-400">Dashboard error: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Lead Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Incoming leads → AI pitches → portfolio matches. New leads auto-fire your n8n webhook.
          </p>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <LeadsPanel />
          <PortfolioPanel />
        </section>
      </div>
    </div>
  );
}

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

  const createMut = useMutation({
    mutationFn: (v: typeof form) => createLead({ data: v }),
    onSuccess: () => {
      setForm({ title: "", description: "", source: "manual", contact: "", ai_pitch: "" });
      qc.invalidateQueries({ queryKey: ["dash", "leads"] });
    },
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "pending" | "pitched" | "won" | "lost" | "ignored" }) =>
      updateStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dash", "leads"] }),
  });

  const proposalMut = useMutation({
    mutationFn: (id: string) => requestProposal({ data: { id } }),
    onSuccess: (_r, id) => {
      setExpandedProposal((s) => ({ ...s, [id]: true }));
      qc.invalidateQueries({ queryKey: ["dash", "leads"] });
    },
  });

  const selected = leads.find((l) => l.id === selectedId) ?? leads[0];

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

        <form
          className="grid gap-2 rounded-lg border border-border/60 bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title.trim()) return;
            createMut.mutate(form);
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Lead title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Source (GitHub, LinkedIn…)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <Textarea rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Contact (email / URL)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            <Input placeholder="AI pitch (optional)" value={form.ai_pitch} onChange={(e) => setForm({ ...form, ai_pitch: e.target.value })} />
          </div>
          <Button type="submit" size="sm" disabled={createMut.isPending} className="justify-self-start">
            <Plus className="h-4 w-4 mr-1" />
            {createMut.isPending ? "Adding & firing webhook…" : "Add lead + trigger n8n"}
          </Button>
        </form>

        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leads in Supabase yet. Once your n8n scrape workflow inserts rows, they will stream in here automatically.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <ul className="space-y-1 max-h-[520px] overflow-auto pr-1">
              {leads.map((l) => {
                const hasProposal = Boolean(l.business_proposal);
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
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{l.source}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">{l.status ?? "pending"}</Badge>
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
                  <Badge>{selected.source}</Badge>
                </div>
                {selected.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
                )}
                {selected.contact && (
                  <p className="text-xs text-muted-foreground">
                    Contact: <span className="text-foreground">{selected.contact}</span>
                  </p>
                )}

                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Sparkles className="h-3.5 w-3.5" /> AI generated pitch
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/60 p-3 text-sm whitespace-pre-wrap min-h-[60px]">
                    {selected.ai_pitch || <span className="text-muted-foreground">No pitch generated yet.</span>}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={proposalMut.isPending && proposalMut.variables === selected.id}
                      onClick={() => proposalMut.mutate(selected.id)}
                      className="bg-gradient-to-r from-primary to-accent"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      {proposalMut.isPending && proposalMut.variables === selected.id
                        ? "Dispatching to n8n…"
                        : selected.business_proposal
                          ? "Regenerate Pro Proposal"
                          : "Generate Pro Proposal"}
                    </Button>
                    {selected.business_proposal && (
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

                <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                  {(["pitched", "won", "lost", "ignored"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={selected.status === s ? "default" : "outline"}
                      size="sm"
                      disabled={statusMut.isPending}
                      onClick={() => statusMut.mutate({ id: selected.id, status: s })}
                    >
                      {s === "pitched" && <Send className="h-3.5 w-3.5 mr-1" />}
                      Mark {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PortfolioPanel() {
  const qc = useQueryClient();
  const { data: items } = useSuspenseQuery(portfolioQO());
  const addFn = useServerFn(addPortfolioFn);
  const delFn = useServerFn(deletePortfolioFn);
  const [draft, setDraft] = useState({ category: "skill", content: "" });

  const addMut = useMutation({
    mutationFn: (v: typeof draft) => addFn({ data: v }),
    onSuccess: () => {
      setDraft({ category: "skill", content: "" });
      qc.invalidateQueries({ queryKey: ["dash", "portfolio"] });
    },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dash", "portfolio"] }),
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center gap-2">
        <Briefcase className="h-5 w-5 text-accent" />
        <CardTitle>My Portfolio</CardTitle>
        <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.content.trim()) return;
            addMut.mutate(draft);
          }}
        >
          <div className="flex gap-2">
            <select
              className="rounded-md border border-border bg-background px-2 text-sm"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              <option value="skill">Skill</option>
              <option value="case-study">Case study</option>
              <option value="project">Project</option>
              <option value="tool">Tool</option>
            </select>
            <Input
              placeholder="e.g. React, Supabase, n8n workflow…"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
            <Button type="submit" size="sm" disabled={addMut.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No portfolio entries yet — add your first skill or case study.</p>
        ) : (
          <ul className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-card/40 p-2"
              >
                <Badge variant="outline" className="capitalize shrink-0">{it.category}</Badge>
                <p className="text-sm flex-1 whitespace-pre-wrap">{it.content}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={delMut.isPending}
                  onClick={() => delMut.mutate(it.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Silence unused-router warning if TS gets picky in future refactors
export const _routerUnused = useRouter;
