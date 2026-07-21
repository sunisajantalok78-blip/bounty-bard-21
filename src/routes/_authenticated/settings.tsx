import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Key, ShieldCheck, Webhook, Coins } from "lucide-react";
import { EnterpriseShell } from "@/components/enterprise/EnterpriseShell";
import {
  listMyOrganizationsFn, getOrgSettingsFn, updateOrgSettingsFn,
} from "@/lib/enterprise.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const listOrgs = useServerFn(listMyOrganizationsFn);
  const getSettings = useServerFn(getOrgSettingsFn);
  const updateSettings = useServerFn(updateOrgSettingsFn);

  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => listOrgs() });
  const org = orgs.data?.organizations?.[0];
  useEffect(() => { if (orgs.data && !org) nav({ to: "/onboarding" }); }, [orgs.data, org, nav]);
  const isAdmin = org?.role === "admin";

  const settings = useQuery({
    queryKey: ["org-settings", org?.id], enabled: !!org,
    queryFn: () => getSettings({ data: { orgId: org!.id } }),
  });

  const [mode, setMode] = useState<"platform" | "byok">("platform");
  const [openai, setOpenai] = useState("");
  const [anthropic, setAnthropic] = useState("");
  const [hub, setHub] = useState("");
  const [sf, setSf] = useState("");
  const [zdr, setZdr] = useState(true);
  const [pool, setPool] = useState<number>(0);

  useEffect(() => {
    if (!settings.data) return;
    setMode(settings.data.ai_key_mode);
    setHub(settings.data.hubspot_webhook_url ?? "");
    setSf(settings.data.salesforce_webhook_url ?? "");
    setZdr(settings.data.zero_data_retention);
    setPool(settings.data.credits_pool);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateSettings>[0]["data"]) =>
      updateSettings({ data: patch }),
    onSuccess: () => {
      toast.success("Saved");
      setOpenai(""); setAnthropic("");
      qc.invalidateQueries({ queryKey: ["org-settings", org!.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!org || !settings.data) {
    return <EnterpriseShell><div className="p-8 text-slate-400">Loading…</div></EnterpriseShell>;
  }

  return (
    <EnterpriseShell orgName={org.name}>
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="mb-2 flex items-center justify-between">
          <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button></Link>
          {!isAdmin && <Badge variant="outline" className="border-amber-400/30 text-amber-300">Read-only (admin required)</Badge>}
        </div>

        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2"><Key className="h-4 w-4" /> AI Provider (BYOK)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={mode === "byok"} onCheckedChange={(v) => setMode(v ? "byok" : "platform")} disabled={!isAdmin} />
                <Label className="text-slate-300">Use my own API keys</Label>
              </div>
              <Badge variant="outline" className="border-white/10 text-slate-400">{mode === "byok" ? "BYOK" : "Platform credits"}</Badge>
            </div>
            {mode === "byok" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400">OpenAI key {settings.data.has_openai_key && <span className="text-emerald-400">· saved</span>}</Label>
                  <Input type="password" placeholder="sk-…" value={openai} onChange={(e) => setOpenai(e.target.value)} disabled={!isAdmin} className="bg-black/40 border-white/10" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Anthropic key {settings.data.has_anthropic_key && <span className="text-emerald-400">· saved</span>}</Label>
                  <Input type="password" placeholder="sk-ant-…" value={anthropic} onChange={(e) => setAnthropic(e.target.value)} disabled={!isAdmin} className="bg-black/40 border-white/10" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-emerald-400/80">
              <ShieldCheck className="h-3 w-3" /> Keys are stored server-side and never returned to the browser.
            </div>
            <div className="pt-2">
              <Button size="sm" disabled={!isAdmin || save.isPending}
                onClick={() => save.mutate({
                  orgId: org.id, ai_key_mode: mode,
                  openai_key: openai || undefined,
                  anthropic_key: anthropic || undefined,
                })}>Save AI settings</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2"><Webhook className="h-4 w-4" /> CRM Webhooks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">HubSpot webhook URL</Label>
              <Input placeholder="https://api.hubapi.com/…" value={hub} onChange={(e) => setHub(e.target.value)} disabled={!isAdmin} className="bg-black/40 border-white/10 font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Salesforce webhook URL</Label>
              <Input placeholder="https://your-instance.my.salesforce.com/…" value={sf} onChange={(e) => setSf(e.target.value)} disabled={!isAdmin} className="bg-black/40 border-white/10 font-mono text-xs" />
            </div>
            <div className="text-[11px] text-slate-500">
              Instantly.ai and Lemlist use the CSV preset export in the Team Library.
            </div>
            <Button size="sm" disabled={!isAdmin || save.isPending}
              onClick={() => save.mutate({ orgId: org.id, hubspot_webhook_url: hub, salesforce_webhook_url: sf })}>
              Save webhooks
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2"><Coins className="h-4 w-4" /> Credits & Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Workspace credit pool</Label>
              <div className="flex items-center gap-2">
                <Input type="number" value={pool} onChange={(e) => setPool(Number(e.target.value))} disabled={!isAdmin} className="bg-black/40 border-white/10 max-w-[200px]" />
                <span className="text-xs text-slate-500 tabular-nums">Used: {settings.data.credits_used}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={zdr} onCheckedChange={setZdr} disabled={!isAdmin} />
              <Label className="text-slate-300">Enforce zero-data-retention on AI calls</Label>
            </div>
            <Button size="sm" disabled={!isAdmin || save.isPending}
              onClick={() => save.mutate({ orgId: org.id, credits_pool: pool, zero_data_retention: zdr })}>
              Save
            </Button>
          </CardContent>
        </Card>
      </div>
    </EnterpriseShell>
  );
}
