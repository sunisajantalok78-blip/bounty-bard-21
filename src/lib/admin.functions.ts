import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const isAdminFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

export const getAdminStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [leadsAll, leadsPending, leadsSuccess, leadsFailed, portfolio, users, cfg] =
      await Promise.all([
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("validation_status", "success"),
        supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("validation_status", "failed"),
        supabaseAdmin.from("my_portfolio").select("id", { count: "exact", head: true }),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("scraper_config").select("*").limit(1).maybeSingle(),
      ]);

    return {
      leadsTotal: leadsAll.count ?? 0,
      leadsPending: leadsPending.count ?? 0,
      leadsSuccess: leadsSuccess.count ?? 0,
      leadsFailed: leadsFailed.count ?? 0,
      portfolioTotal: portfolio.count ?? 0,
      usersTotal: users.data?.users?.length ?? 0,
      config: cfg.data,
      generatedAt: new Date().toISOString(),
    };
  });

export const purgeStaleLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("purge_stale_ignored_leads");
    if (error) throw error;
    return { deleted: data ?? 0 };
  });

export const dispatchAdminN8nFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { message?: string }) => ({ message: String(d?.message ?? "ping") }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { dispatchToN8n } = await import("@/lib/n8n.server");
    return dispatchToN8n({ type: "test", data: { from: "admin_panel", message: data.message } });
  });
