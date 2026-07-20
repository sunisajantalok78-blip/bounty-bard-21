import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus, Copy, ShieldCheck, Coins } from "lucide-react";
import {
  listMyOrganizationsFn, listOrgMembersFn, listInvitationsFn,
  inviteMemberFn, allocateCreditsFn, updateMemberRoleFn, getEnterpriseMetricsFn,
} from "@/lib/enterprise.functions";
import { EnterpriseShell, MetricsBar } from "@/components/enterprise/EnterpriseShell";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

function TeamPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listOrgs = useServerFn(listMyOrganizationsFn);
  const listMembers = useServerFn(listOrgMembersFn);
  const listInvites = useServerFn(listInvitationsFn);
  const invite = useServerFn(inviteMemberFn);
  const allocate = useServerFn(allocateCreditsFn);
  const changeRole = useServerFn(updateMemberRoleFn);
  const getMetrics = useServerFn(getEnterpriseMetricsFn);

  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => listOrgs() });
  const org = orgs.data?.organizations?.[0];
  useEffect(() => { if (orgs.data && !org) navigate({ to: "/onboarding" }); }, [orgs.data, org, navigate]);

  const members = useQuery({ queryKey: ["members", org?.id], enabled: !!org, queryFn: () => listMembers({ data: { orgId: org!.id } }) });
  const invites = useQuery({ queryKey: ["invites", org?.id], enabled: !!org, queryFn: () => listInvites({ data: { orgId: org!.id } }) });
  const metrics = useQuery({ queryKey: ["metrics", org?.id], enabled: !!org, queryFn: () => getMetrics({ data: { orgId: org!.id } }) });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  const inviteM = useMutation({
    mutationFn: () => invite({ data: { orgId: org!.id, email, role } }),
    onSuccess: (r) => {
      toast.success("Invitation created");
      navigator.clipboard.writeText(r.token).catch(() => {});
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invites", org!.id] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const isAdmin = org?.role === "admin";

  return (
    <EnterpriseShell orgName={org?.name}>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button></Link>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/80"><ShieldCheck className="h-3 w-3" /> BYOK & zero-data-retention</div>
        </div>

        {metrics.data && <MetricsBar {...metrics.data} />}

        {isAdmin && (
          <Card className="bg-[#0b0f16] border-white/5 mb-4">
            <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite a teammate</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Input type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/40 border-white/10 max-w-xs" />
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger className="w-32 bg-black/40 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                </Select>
                <Button onClick={() => inviteM.mutate()} disabled={!email || inviteM.isPending}>Create invite</Button>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">Token is copied to clipboard. Share it with the invitee — they paste it on the onboarding screen.</div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-[#0b0f16] border-white/5 mb-4">
          <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Coins className="h-4 w-4" /> Members & credit allocation</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-400 text-xs">
                <tr><th className="text-left px-4 py-2">User</th><th className="text-left px-4 py-2">Role</th><th className="text-left px-4 py-2">Credits used / allocated</th><th className="text-right px-4 py-2">Allocate</th></tr>
              </thead>
              <tbody>
                {(members.data ?? []).map((m: any) => (
                  <MemberRow key={m.id} m={m} isAdmin={!!isAdmin}
                    onAllocate={async (n) => { await allocate({ data: { memberId: m.id, credits: n } }); qc.invalidateQueries({ queryKey: ["members", org!.id] }); toast.success("Updated"); }}
                    onRole={async (r) => { await changeRole({ data: { memberId: m.id, role: r } }); qc.invalidateQueries({ queryKey: ["members", org!.id] }); toast.success("Role updated"); }} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="bg-[#0b0f16] border-white/5">
          <CardHeader><CardTitle className="text-slate-100">Pending invitations</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!invites.data?.length && <div className="p-6 text-center text-slate-500 text-sm">No pending invitations.</div>}
            <div className="divide-y divide-white/5">
              {(invites.data ?? []).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm text-slate-200">{i.email}</div>
                    <div className="text-[11px] text-slate-500">Role: {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.accepted_at ? <Badge className="bg-emerald-500/10 text-emerald-400 border-none">Accepted</Badge> :
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(i.token); toast.success("Token copied"); }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy token</Button>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </EnterpriseShell>
  );
}

function MemberRow({ m, isAdmin, onAllocate, onRole }: { m: any; isAdmin: boolean; onAllocate: (n: number) => void; onRole: (r: "admin" | "member") => void }) {
  const [val, setVal] = useState<number>(m.credits_allocated ?? 0);
  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-3 font-mono text-xs text-slate-400 truncate max-w-[280px]">{m.user_id}</td>
      <td className="px-4 py-3">
        {isAdmin ? (
          <Select value={m.role} onValueChange={(v) => onRole(v as any)}>
            <SelectTrigger className="h-7 w-28 bg-black/40 border-white/10 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
          </Select>
        ) : <Badge variant="outline" className="border-white/10 text-slate-300">{m.role}</Badge>}
      </td>
      <td className="px-4 py-3 text-slate-300 tabular-nums">{m.credits_used ?? 0} / {m.credits_allocated ?? 0}</td>
      <td className="px-4 py-3">
        {isAdmin && (
          <div className="flex justify-end gap-2">
            <Input type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} className="h-7 w-24 bg-black/40 border-white/10 text-xs text-right" />
            <Button size="sm" variant="secondary" onClick={() => onAllocate(val)}>Set</Button>
          </div>
        )}
      </td>
    </tr>
  );
}
