// Server functions for the clean dashboard: leads + my_portfolio.
// Uses Lovable Cloud Supabase (service role) since the app has no per-user auth.
// Every new lead insert fires the outbound n8n webhook.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listLeadsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id,title,description,source,contact,ai_pitch,status,budget,urgency,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const updateLeadStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string; ai_pitch?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "pitched", "won", "lost", "ignored"]),
        ai_pitch: z.string().max(8000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status: string; ai_pitch?: string } = { status: data.status };
    if (data.ai_pitch !== undefined) patch.ai_pitch = data.ai_pitch;
    const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createLeadFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    title: string;
    description?: string;
    source?: string;
    contact?: string;
    ai_pitch?: string;
  }) =>
    z
      .object({
        title: z.string().min(1).max(500),
        description: z.string().max(8000).optional(),
        source: z.string().max(64).default("manual"),
        contact: z.string().max(500).optional(),
        ai_pitch: z.string().max(8000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("leads")
      .insert({
        title: data.title,
        description: data.description ?? null,
        source: data.source ?? "manual",
        contact: data.contact ?? null,
        ai_pitch: data.ai_pitch ?? null,
        status: "pending",
      })
      .select("id,title,description,source,contact,ai_pitch,status,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");

    // Fire n8n webhook (non-fatal)
    try {
      const { dispatchToN8n } = await import("@/lib/n8n.server");
      await dispatchToN8n({ type: "lead.new", data: row });
    } catch { /* non-fatal */ }

    return row;
  });

export const listPortfolioFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("my_portfolio")
    .select("id,category,content,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const addPortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((d: { category: string; content: string }) =>
    z.object({ category: z.string().min(1).max(120), content: z.string().min(1).max(8000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("my_portfolio")
      .insert(data)
      .select("id,category,content,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return row;
  });

export const deletePortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("my_portfolio").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
