import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Clock, Loader2, CheckCircle2, XCircle, Sparkles, Download, Send, Eye,
} from "lucide-react";
import { getBatchFn, processBatchTickFn, exportToCrmFn } from "@/lib/enterprise.functions";
import { EnterpriseShell } from "@/components/enterprise/EnterpriseShell";

export const Route = createFileRoute("/_authenticated/batches/$id")({
  component: BatchDetail,
});

const STATUS_META: Record<string, { label: string; icon: any; className: string }> = {
  pending:    { label: "Pending",    icon: Clock,       className: "text-slate-400 bg-slate-500/10" },
  scraping:   { label: "Scraping",   icon: Loader2,     className: "text-cyan-400 bg-cyan-500/10" },
  analyzing:  { label: "Analyzing",  icon: Sparkles,    className: "text-violet-400 bg-violet-500/10" },
  completed:  { label: "Completed",  icon: CheckCircle2,className: "text-emerald-400 bg-emerald-500/10" },
  failed:     { label: "Failed",     icon: XCircle,     className: "text-rose-400 bg-rose-500/10" },
};

function BatchDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getBatch = useServerFn(getBatchFn);
  const tick = useServerFn(processBatchTickFn);
  const exportCrm = useServerFn(exportToCrmFn);

  const { data } = useQuery({
    queryKey: ["batch", id],
    queryFn: () => getBatch({ data: { batchId: id } }),
    refetchInterval: 2500,
  });

  const tickM = useMutation({
    mutationFn: () => tick({ data: { batchId: id, take: 5 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batch", id] }),
  });

  // Auto-drain the queue every 3s while batch is not done.
  useEffect(() => {
    if (!data?.batch) return;
    if (data.batch.status === "completed" || data.batch.status === "cancelled" || data.batch.status === "failed") return;
    const t = setInterval(() => { tickM.mutate(); }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.batch?.status]);

  const batch = data?.batch;
  const leads = (data?.leads ?? []) as any[];
  const pct = batch?.total ? Math.round(((batch.processed + batch.failed) / batch.total) * 100) : 0;

  const [previewLead, setPreviewLead] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function exportCsv() {
    const cols = ["title", "company_name", "domain", "contact", "status", "ai_pitch", "business_proposal"];
    const rows = leads.filter((l) => selected.size === 0 || selected.has(l.id));
    const header = cols.join(",");
    const csv = [header, ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${batch?.filename ?? "batch"}-export.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads`);
  }

  async function pushCrm(provider: "hubspot" | "salesforce" | "instantly" | "lemlist") {
    if (!batch) return;
    const ids = leads.filter((l) => selected.size === 0 || selected.has(l.id)).map((l) => l.id);
    if (!ids.length) return toast.error("Nothing to export");
    try {
      const res = await exportCrm({ data: { orgId: batch.organization_id, leadIds: ids, provider } });
      toast.success(`${provider}: ${res.exported} leads queued`);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <EnterpriseShell>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/bulk-upload"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
        </div>

        <Card className="bg-[#0b0f16] border-white/5 mb-4">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Batch</div>
                <CardTitle className="text-slate-100">{batch?.filename ?? "Loading…"}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV</Button>
                <Button size="sm" variant="outline" onClick={() => pushCrm("hubspot")}><Send className="h-3.5 w-3.5 mr-1.5" /> HubSpot</Button>
                <Button size="sm" variant="outline" onClick={() => pushCrm("salesforce")}><Send className="h-3.5 w-3.5 mr-1.5" /> Salesforce</Button>
                <Button size="sm" variant="outline" onClick={() => pushCrm("instantly")}><Send className="h-3.5 w-3.5 mr-1.5" /> Instantly</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>{batch?.processed ?? 0}/{batch?.total ?? 0} processed · {batch?.failed ?? 0} failed</span>
              <span className="font-mono text-cyan-400">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full transition-all duration-500 ${batch?.status === "failed" ? "bg-rose-500" : "bg-gradient-to-r from-cyan-400 to-violet-500"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Status: <span className="uppercase tracking-widest">{batch?.status ?? "—"}</span>
              {batch?.status === "processing" && <span className="ml-2 text-cyan-400">· auto-refreshing</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader><CardTitle className="text-slate-100">Leads ({leads.length})</CardTitle></CardHeader>
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
                  {leads.map((l) => {
                    const meta = STATUS_META[l.processing_status ?? "pending"] ?? STATUS_META.pending;
                    const Icon = meta.icon;
                    return (
                      <tr key={l.id} className="border-t border-white/5 hover:bg-white/2">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="accent-cyan-400" />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-200 truncate max-w-[280px]">{l.title}</div>
                          {l.company_name && <div className="text-[11px] text-slate-500">{l.company_name}</div>}
                        </td>
                        <td className="px-3 py-2 text-slate-400 font-mono text-xs">{l.domain ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge className={`${meta.className} border-none`}>
                            <Icon className={`h-3 w-3 mr-1 ${l.processing_status === "scraping" || l.processing_status === "analyzing" ? "animate-spin" : ""}`} />
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[200px]">{l.contact ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setPreviewLead(l)}><Eye className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                  {leads.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500 text-sm">No leads in this batch.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!previewLead} onOpenChange={(o) => !o && setPreviewLead(null)}>
          <DialogContent className="max-w-2xl bg-[#0b0f16] border-white/10 text-slate-100">
            <DialogHeader><DialogTitle>{previewLead?.title}</DialogTitle></DialogHeader>
            {previewLead && (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">{previewLead.domain} · {previewLead.contact ?? "no contact"}</div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">AI Pitch</div>
                  <Textarea value={previewLead.ai_pitch ?? ""} readOnly className="min-h-[180px] bg-black/40 border-white/10 text-slate-200 font-mono text-xs" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(previewLead.ai_pitch ?? ""); toast.success("Copied"); }}>Copy pitch</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseShell>
  );
}
