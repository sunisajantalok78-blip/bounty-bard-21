import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganizationFn, acceptInvitationFn } from "@/lib/enterprise.functions";
import { Sparkles, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const createOrg = useServerFn(createOrganizationFn);
  const acceptInv = useServerFn(acceptInvitationFn);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (name.trim().length < 2) return toast.error("Workspace name is required");
    setBusy(true);
    try {
      await createOrg({ data: { name: name.trim() } });
      toast.success("Workspace created");
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function handleAccept() {
    if (!token.trim()) return toast.error("Paste your invitation token");
    setBusy(true);
    try {
      await acceptInv({ data: { token: token.trim() } });
      toast.success("Joined workspace");
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl grid md:grid-cols-2 gap-5">
        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-cyan-400"><Sparkles className="h-4 w-4" /> <span className="text-xs uppercase tracking-widest">New workspace</span></div>
            <CardTitle className="text-slate-100">Create your organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-400">Spin up a multi-seat workspace for your sales team or agency. You'll be the admin.</p>
            <Input placeholder="Acme Growth Labs" value={name} onChange={(e) => setName(e.target.value)} className="bg-black/40 border-white/10" />
            <Button onClick={handleCreate} disabled={busy} className="w-full">Create workspace</Button>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80 pt-1">
              <ShieldCheck className="h-3 w-3" /> Encrypted at rest • Zero data retention AI
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-violet-400"><Users className="h-4 w-4" /> <span className="text-xs uppercase tracking-widest">Join a team</span></div>
            <CardTitle className="text-slate-100">Accept an invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-400">Paste the invitation token your admin shared with you.</p>
            <Input placeholder="Invitation token" value={token} onChange={(e) => setToken(e.target.value)} className="bg-black/40 border-white/10 font-mono text-xs" />
            <Button variant="secondary" onClick={handleAccept} disabled={busy} className="w-full">Join workspace</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
