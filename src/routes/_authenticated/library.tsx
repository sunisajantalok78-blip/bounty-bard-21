import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Download, Eye, ShieldCheck, Send } from "lucide-react";
import { listMyOrganizationsFn, getEnterpriseMetricsFn, exportToCrmFn } from "@/lib/enterprise.functions";
import { supabase } from "@/integrations/supabase/client";
import { EnterpriseShell, MetricsBar } from "@/components/enterprise/EnterpriseShell";

export const Route = createFileRoute("/_authenticated/library")({
  component: Library,
});

type Preset = "generic" | "instantly" | "lemlist";
const PRESETS: Record<Preset, { label: string; cols: [string, string][] }> = {
  generic:   { label: "Generic",   cols: [["title","title"],["company_name","company"],["domain","domain"],["contact","email"],["status","status"],["ai_pitch","pitch"],["business_proposal","proposal"]] },
  instantly: { label: "Instantly", cols: [["contact","email"],["company_name","company_name"],["domain","website"],["ai_pitch","first_line"],["business_proposal","icebreaker"]] },
  lemlist:   { label: "Lemlist",   cols: [["contact","email"],["company_name","companyName"],["domain","website"],["ai_pitch","icebreaker"],["business_proposal","customVar1"]] },
};

function toCsv(rows: any[], cols: [string, string][]): string {
  const header = cols.map(([, out]) => out).join(",");
  const body = rows.map((r) => cols.map(([src]) => JSON.stringify(r[src] ?? "")).join(",")).join("\n");
  return header + "\n" + body;
}

function Library() {
  const navigate = useNavigate();
  const listOrgs = useServerFn(listMyOrganizationsFn);
  const getMetrics = useServerFn(getEnterpriseMetricsFn);
  const sendCrm = useServerFn(exportToCrmFn);
  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => listOrgs() });
  const org = orgs.data?.organizations?.[0];
  useEffect(() => { if (orgs.data && !org) navigate({ to: "/onboarding" }); }, [orgs.data, org, navigate]);

  const metrics = useQuery({ queryKey: ["metrics", org?.id], enabled: !!org, queryFn: () => getMetrics({ data: { orgId: org!.id } }) });

  const leads = useQuery({
    queryKey: ["library-leads", org?.id],
    enabled: !!org,
    refetchInterval: 5000,
    queryFn: async () => {
      const c: any = supabase;
      const { data, error } = await c.from("leads")
        .select("id,title,domain,company_name,contact,status,processing_status,ai_pitch,business_proposal,tags,created_at")
        .eq("organization_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data as any[];
    },
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [preset, setPreset] = useState<Preset>("generic");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<any>(null);

  const filtered = useMemo(() => {
    const src = leads.data ?? [];
    return src.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (!q.trim()) return true;
      const hay = [l.title, l.company_name, l.domain, l.contact, l.ai_pitch].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [leads.data, q, status]);

  const targetIds = selected.size ? filtered.filter((l) => selected.has(l.id)).map((l) => l.id) : filtered.map((l) => l.id);
  const targetRows = filtered.filter((l) => targetIds.includes(l.id));

  function exportCsv() {
    const csv = toCsv(targetRows, PRESETS[preset].cols);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `team-library-${preset}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${targetRows.length} leads (${PRESETS[preset].label})`);
  }

  const crm = useMutation({
    mutationFn: (provider: "hubspot" | "salesforce") =>
      sendCrm({ data: { orgId: org!.id, leadIds: targetIds, provider } }),
    onSuccess: (r) => toast.success(`Sent ${r.exported} to ${r.provider}`),
    onError: (e) => toast.error((e as Error).message),
  });

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <EnterpriseShell orgName={org?.name}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button></Link>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80"><ShieldCheck className="h-3 w-3" /> Shared team workspace</div>
        </div>

        {metrics.data && <MetricsBar {...metrics.data} />}

        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-slate-100">
                Team Library ({filtered.length}) {selected.size > 0 && <span className="ml-2 text-xs text-cyan-400 font-normal">{selected.size} selected</span>}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9 bg-black/40 border-white/10 w-56" />
                </div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md bg-black/40 border border-white/10 text-sm px-2">
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option><option value="ready">Ready</option>
                  <option value="pitched">Pitched</option><option value="won">Won</option>
                  <option value="lost">Lost</option><option value="ignored">Ignored</option>
                </select>
                <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className="h-9 rounded-md bg-black/40 border border-white/10 text-sm px-2">
                  {Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => crm.mutate("hubspot")} disabled={targetIds.length === 0 || crm.isPending}>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> HubSpot
                </Button>
                <Button size="sm" variant="outline" onClick={() => crm.mutate("salesforce")} disabled={targetIds.length === 0 || crm.isPending}>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Salesforce
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-slate-400 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2">Lead</th>
                    <th className="text-left px-3 py-2">Domain</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Contact</th>
                    <th className="text-right px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-t border-white/5 hover:bg-white/2">
                      <td className="px-3 py-2"><Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} /></td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-200 truncate max-w-[300px]">{l.title}</div>
                        {l.company_name && <div className="text-[11px] text-slate-500">{l.company_name}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-400 font-mono text-xs">{l.domain ?? "—"}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="border-white/10 text-slate-300">{l.status}</Badge></td>
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[220px]">{l.contact ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setPreview(l)}><Eye className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500 text-sm">No matching leads.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-3xl bg-[#0b0f16] border-white/10 text-slate-100">
            <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
            {preview && (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">{preview.domain} · {preview.contact ?? "no contact"} · <span className="uppercase">{preview.status}</span></div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">AI Pitch</div>
                  <Textarea defaultValue={preview.ai_pitch ?? ""} className="min-h-[160px] bg-black/40 border-white/10 text-slate-200 text-sm" />
                </div>
                {preview.business_proposal && (
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">Business Proposal</div>
                    <Textarea defaultValue={preview.business_proposal ?? ""} className="min-h-[220px] bg-black/40 border-white/10 text-slate-200 text-sm" />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(preview.ai_pitch ?? ""); toast.success("Copied"); }}>Copy pitch</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseShell>
  );
}
