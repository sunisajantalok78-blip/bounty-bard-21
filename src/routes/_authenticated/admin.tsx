import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  isAdminFn,
  getAdminStatsFn,
  purgeStaleLeadsFn,
  dispatchAdminN8nFn,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Shield, LogOut, Users, Database, Send, Trash2, RefreshCw, ArrowLeft } from "lucide-react";

const adminStatsQuery = () =>
  queryOptions({
    queryKey: ["admin", "stats"],
    queryFn: () => getAdminStatsFn(),
    staleTime: 15_000,
  });

const adminCheckQuery = () =>
  queryOptions({
    queryKey: ["admin", "check"],
    queryFn: () => isAdminFn(),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin Room — Bounty Hunter" }],
  }),
  loader: async ({ context }) => {
    const check = await context.queryClient.ensureQueryData(adminCheckQuery());
    if (check?.isAdmin) {
      await context.queryClient.ensureQueryData(adminStatsQuery());
    }
    return null;
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Admin room unavailable</h1>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        <Link to="/dashboard" className="text-primary hover:underline text-sm mt-4 inline-block">
          Back to dashboard
        </Link>
      </div>
    </div>
  ),
  component: AdminRoom,
});

function AdminRoom() {
  const { data: check } = useSuspenseQuery(adminCheckQuery());
  if (!check.isAdmin) return <NotAdmin />;
  return <AdminInner />;
}

function NotAdmin() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        <Shield className="h-10 w-10 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="text-sm text-muted-foreground">
          This room is restricted. Contact the owner if you need access.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-2" /> Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

function AdminInner() {
  const { data: stats } = useSuspenseQuery(adminStatsQuery());
  const qc = useQueryClient();
  const nav = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [pingMsg, setPingMsg] = useState("Hello from admin room");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const purge = useServerFn(purgeStaleLeadsFn);
  const ping = useServerFn(dispatchAdminN8nFn);

  const purgeMut = useMutation({
    mutationFn: () => purge(),
    onSuccess: (r) => {
      toast.success(`Purged ${r.deleted} stale leads`);
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const pingMut = useMutation({
    mutationFn: () => ping({ data: { message: pingMsg } }),
    onSuccess: (r) => toast[r.ok ? "success" : "error"](r.ok ? "n8n dispatched" : `n8n: ${r.error ?? "failed"}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-semibold tracking-tight">Admin Room</h1>
              <p className="text-xs text-muted-foreground">{email ?? "…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin", "stats"] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-4">Live stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Stat icon={<Users className="h-4 w-4" />} label="Users" value={stats.usersTotal} />
            <Stat icon={<Database className="h-4 w-4" />} label="Leads" value={stats.leadsTotal} />
            <Stat label="Pending" value={stats.leadsPending} />
            <Stat label="Validated" value={stats.leadsSuccess} tone="success" />
            <Stat label="Failed" value={stats.leadsFailed} tone="danger" />
            <Stat label="Portfolio" value={stats.portfolioTotal} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Generated {new Date(stats.generatedAt).toLocaleTimeString()}
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Send className="h-4 w-4" /> n8n test dispatch</h3>
              <p className="text-xs text-muted-foreground mt-1">Sends a test event to the configured N8N_WEBHOOK_URL.</p>
            </div>
            <Input value={pingMsg} onChange={(e) => setPingMsg(e.target.value)} placeholder="Message" />
            <Button onClick={() => pingMut.mutate()} disabled={pingMut.isPending} className="w-full">
              {pingMut.isPending ? "Dispatching…" : "Send to n8n"}
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Trash2 className="h-4 w-4" /> Maintenance</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Manually purge ignored / invalid leads older than 7 days.
              </p>
            </div>
            <Button variant="destructive" onClick={() => purgeMut.mutate()} disabled={purgeMut.isPending} className="w-full">
              {purgeMut.isPending ? "Purging…" : "Purge stale leads now"}
            </Button>
          </Card>
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-4">Scraper config</h2>
          <Card className="p-6 text-xs font-mono overflow-auto">
            <pre>{JSON.stringify(stats.config, null, 2)}</pre>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Stat({
  icon, label, value, tone,
}: { icon?: React.ReactNode; label: string; value: number; tone?: "success" | "danger" }) {
  const color =
    tone === "success" ? "text-emerald-400" : tone === "danger" ? "text-rose-400" : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </Card>
  );
}
