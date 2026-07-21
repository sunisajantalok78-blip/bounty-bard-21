import { Link, useRouterState } from "@tanstack/react-router";
import { ReactNode } from "react";
import {
  LayoutDashboard, Upload, Users, Library, ShieldCheck, Sparkles, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bulk-upload", label: "Bulk Upload", icon: Upload },
  { to: "/library", label: "Team Library", icon: Library },
  { to: "/team", label: "Team & Credits", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function EnterpriseShell({ children, orgName }: { children: ReactNode; orgName?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-[#07090d] text-slate-100">
      <div className="flex">
        <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-[#0b0f16] px-4 py-6 sticky top-0 h-screen">
          <div className="flex items-center gap-2 px-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-black" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Bounty Hunter</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Enterprise</div>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2 px-2 pt-6 border-t border-white/5">
            {orgName && <div className="text-xs text-slate-500">Workspace</div>}
            {orgName && <div className="text-sm font-medium text-slate-200 truncate">{orgName}</div>}
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/80">
              <ShieldCheck className="h-3 w-3" /> Zero data retention
            </div>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

export function MetricsBar({
  totalLeads, matches, creditsRemaining, activeBatches,
}: { totalLeads: number; matches: number; creditsRemaining: number; activeBatches: number }) {
  const cards = [
    { label: "Total Leads Scanned", value: totalLeads.toLocaleString(), tint: "from-cyan-500/20 to-cyan-500/0" },
    { label: "Successful Matches", value: matches.toLocaleString(), tint: "from-emerald-500/20 to-emerald-500/0" },
    { label: "Credits Remaining", value: creditsRemaining.toLocaleString(), tint: "from-amber-500/20 to-amber-500/0" },
    { label: "Active Campaigns", value: activeBatches.toLocaleString(), tint: "from-violet-500/20 to-violet-500/0" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={cn("rounded-xl border border-white/5 bg-gradient-to-b p-4", c.tint)}>
          <div className="text-[11px] uppercase tracking-widest text-slate-400">{c.label}</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
