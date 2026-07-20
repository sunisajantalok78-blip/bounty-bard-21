import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, FileSpreadsheet, X, ShieldCheck, Rocket } from "lucide-react";
import { listMyOrganizationsFn, uploadBatchFn, listBatchesFn } from "@/lib/enterprise.functions";
import { EnterpriseShell, MetricsBar } from "@/components/enterprise/EnterpriseShell";
import { getEnterpriseMetricsFn } from "@/lib/enterprise.functions";

type Row = { domain?: string; company_name?: string; title?: string; contact?: string; description?: string };

export const Route = createFileRoute("/_authenticated/bulk-upload")({
  component: BulkUpload,
});

function BulkUpload() {
  const navigate = useNavigate();
  const listOrgs = useServerFn(listMyOrganizationsFn);
  const upload = useServerFn(uploadBatchFn);
  const listBatches = useServerFn(listBatchesFn);
  const getMetrics = useServerFn(getEnterpriseMetricsFn);

  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => listOrgs() });
  const orgId = orgs.data?.organizations?.[0]?.id;
  const orgName = orgs.data?.organizations?.[0]?.name;

  useEffect(() => {
    if (orgs.data && !orgs.data.organizations.length) navigate({ to: "/onboarding" });
  }, [orgs.data, navigate]);

  const metrics = useQuery({
    queryKey: ["metrics", orgId], enabled: !!orgId,
    queryFn: () => getMetrics({ data: { orgId: orgId! } }),
  });
  const batches = useQuery({
    queryKey: ["batches", orgId], enabled: !!orgId,
    queryFn: () => listBatches({ data: { orgId: orgId! } }),
    refetchInterval: 4000,
  });

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function parseFile(f: File) {
    if (f.size > 5 * 1024 * 1024) return toast.error("File too large (max 5MB)");
    setFile(f);
    Papa.parse<Row>(f, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const cleaned: Row[] = (res.data as any[]).slice(0, 1000).map((r) => ({
          domain: (r.domain ?? r.Domain ?? r.website ?? r.URL ?? r.url ?? "").toString().trim() || undefined,
          company_name: (r.company_name ?? r.company ?? r.Company ?? r.name ?? "").toString().trim() || undefined,
          title: (r.title ?? r.Title ?? "").toString().trim() || undefined,
          contact: (r.contact ?? r.email ?? r.Email ?? "").toString().trim() || undefined,
          description: (r.description ?? r.notes ?? r.Notes ?? "").toString().trim() || undefined,
        })).filter((r) => r.domain || r.company_name || r.title || r.contact);
        setRows(cleaned);
        if (!cleaned.length) toast.error("No valid rows found. Expected columns: domain, company_name, contact");
        else toast.success(`Parsed ${cleaned.length} rows`);
      },
      error: (err) => toast.error(err.message),
    });
  }

  async function handleUpload() {
    if (!orgId) return;
    if (!file || !rows.length) return toast.error("Choose a CSV first");
    setBusy(true);
    try {
      const res = await upload({ data: { orgId, filename: file.name, rows } });
      toast.success(`Queued ${res.inserted} leads`);
      navigate({ to: "/batches/$id", params: { id: res.batchId } });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <EnterpriseShell orgName={orgName}>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Bulk Ingestion</div>
            <h1 className="text-2xl font-semibold">Upload up to 1,000 leads</h1>
          </div>
          <Link to="/dashboard"><Button variant="ghost" size="sm">← Dashboard</Button></Link>
        </div>

        {metrics.data && <MetricsBar {...metrics.data} />}

        <Card className="bg-[#0b0f16] border-white/5 mb-6">
          <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><UploadCloud className="h-4 w-4" /> Drop CSV or Excel export</CardTitle></CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-xl px-8 py-14 text-center transition ${dragOver ? "border-cyan-400 bg-cyan-400/5" : "border-white/10 hover:border-white/20 hover:bg-white/2"}`}
            >
              <UploadCloud className="h-10 w-10 mx-auto text-slate-500 mb-3" />
              <div className="font-medium text-slate-200">Drag & drop your file here</div>
              <div className="text-xs text-slate-500 mt-1">CSV or Excel export • max 1,000 rows • columns: domain, company_name, contact, description</div>
              <input ref={inputRef} type="file" accept=".csv,text/csv,.xls,.xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
            </div>

            {file && (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-black/30 border border-white/5 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="truncate text-sm">{file.name}</div>
                  <div className="text-xs text-slate-500 shrink-0">· {rows.length} rows</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleUpload} disabled={busy || !rows.length}>
                    <Rocket className="h-3.5 w-3.5 mr-1.5" /> Queue batch
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setFile(null); setRows([]); }}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {previewRows.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-white/5">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="text-left px-3 py-2">Domain</th><th className="text-left px-3 py-2">Company</th>
                      <th className="text-left px-3 py-2">Contact</th><th className="text-left px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="px-3 py-2 text-slate-300">{r.domain ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-300">{r.company_name ?? r.title ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-400">{r.contact ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[200px]">{r.description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 5 && <div className="text-[11px] text-slate-500 px-3 py-2 border-t border-white/5">+ {rows.length - 5} more…</div>}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80 mt-4">
              <ShieldCheck className="h-3 w-3" /> Encrypted at rest • Processed via zero-data-retention endpoints
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader><CardTitle className="text-slate-100">Recent batches</CardTitle></CardHeader>
          <CardContent>
            {!batches.data?.length && <div className="text-sm text-slate-500 py-6 text-center">No batches yet. Upload your first CSV above.</div>}
            <div className="space-y-2">
              {batches.data?.map((b: any) => {
                const pct = b.total ? Math.round(((b.processed + b.failed) / b.total) * 100) : 0;
                return (
                  <Link key={b.id} to="/batches/$id" params={{ id: b.id }} className="block rounded-lg border border-white/5 bg-black/30 hover:bg-white/5 transition p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{b.filename}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{b.processed}/{b.total} processed · {b.failed} failed · <span className="uppercase tracking-widest">{b.status}</span></div>
                      </div>
                      <div className="text-xs text-cyan-400 font-mono">{pct}%</div>
                    </div>
                    <div className="h-1.5 mt-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full ${b.status === "failed" ? "bg-rose-500" : "bg-gradient-to-r from-cyan-400 to-violet-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </EnterpriseShell>
  );
}
