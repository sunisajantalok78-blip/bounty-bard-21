// Server functions for the dashboard: leads, my_portfolio, scraper_config.
// Uses Lovable Cloud Supabase (service role) since the app has no per-user auth.
// Every new lead insert fires the outbound n8n webhook.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const LEAD_STATUSES = [
  "pending",
  "generating",
  "ready",
  "pitched",
  "sent",
  "won",
  "closed",
  "lost",
  "ignored",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const listLeadsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id,title,description,source,contact,ai_pitch,business_proposal,raw_social_data,status,validation_status,processing_status,budget,urgency,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const triggerGlobalScrapeFn = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin
    .from("scraper_config")
    .select("id,sources,keywords,updated_at")
    .eq("singleton", true)
    .maybeSingle();
  const { dispatchToN8n } = await import("@/lib/n8n.server");
  const res = await dispatchToN8n({
    type: "test",
    data: { action: "trigger_live_scrape", config: cfg ?? null },
  });
  return { ok: res.ok, status: res.status, error: res.error };
});

export const requestProposalFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("id,title,description,source,contact,raw_social_data")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("lead not found");

    await supabaseAdmin.from("leads").update({ status: "generating" }).eq("id", data.id);

    const { dispatchToN8n } = await import("@/lib/n8n.server");
    const res = await dispatchToN8n({
      type: "lead.new",
      data: { action: "generate_proposal", lead_id: lead.id, lead },
    });
    return { ok: res.ok, status: res.status, error: res.error };
  });

export const updateLeadStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: LeadStatus; ai_pitch?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(LEAD_STATUSES),
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
    quick_input?: string;
  }) =>
    z
      .object({
        title: z.string().min(1).max(500),
        description: z.string().max(8000).optional(),
        source: z.string().max(64).default("manual"),
        contact: z.string().max(500).optional(),
        ai_pitch: z.string().max(8000).optional(),
        quick_input: z.string().max(8000).optional(),
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

    try {
      const { dispatchToN8n } = await import("@/lib/n8n.server");
      await dispatchToN8n({
        type: "lead.new",
        data: { action: "new_manual_lead", lead_data: { ...row, quick_input: data.quick_input ?? null } },
      });
    } catch { /* non-fatal */ }

    return row;
  });

// Quick ingest — accepts a URL or raw job description, auto-detects source.
export const quickIngestFn = createServerFn({ method: "POST" })
  .inputValidator((d: { input: string }) =>
    z.object({ input: z.string().trim().min(3).max(8000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = data.input.trim();
    const isUrl = /^https?:\/\//i.test(raw);
    let source = "manual";
    let contact: string | null = null;
    let title = raw.slice(0, 120);
    let description: string | null = raw.length > 120 ? raw : null;

    if (isUrl) {
      contact = raw;
      const host = (() => {
        try { return new URL(raw).hostname.toLowerCase(); } catch { return ""; }
      })();
      if (host.includes("facebook") || host.includes("fb.")) source = "facebook";
      else if (host.includes("instagram")) source = "instagram";
      else if (host.includes("linkedin")) source = "linkedin";
      else if (host.includes("upwork")) source = "upwork";
      else if (host.includes("fiverr")) source = "fiverr";
      else source = "web";
      title = `${source} lead — ${host}`;
      description = raw;
    } else {
      const firstLine = raw.split(/\n/)[0]?.trim() ?? raw;
      title = firstLine.slice(0, 120);
      description = raw;
      source = "paste";
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("leads")
      .insert({ title, description, source, contact, status: "pending" })
      .select("id,title,description,source,contact,ai_pitch,status,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");

    try {
      const { dispatchToN8n } = await import("@/lib/n8n.server");
      await dispatchToN8n({
        type: "lead.new",
        data: { action: "new_manual_lead", lead_data: row },
      });
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

export const updatePortfolioFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; category: string; content: string }) =>
    z
      .object({
        id: z.string().uuid(),
        category: z.string().min(1).max(120),
        content: z.string().min(1).max(8000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("my_portfolio")
      .update({ category: data.category, content: data.content })
      .eq("id", data.id)
      .select("id,category,content,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "update failed");
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

// ---------- Scraper config ----------
export type ScraperSources = {
  facebook: boolean;
  instagram: boolean;
  google: boolean;
  linkedin: boolean;
};

export const getScraperConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("scraper_config")
    .select("id,sources,keywords,updated_at")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const { data: created, error: insErr } = await supabaseAdmin
    .from("scraper_config")
    .insert({ singleton: true })
    .select("id,sources,keywords,updated_at")
    .single();
  if (insErr || !created) throw new Error(insErr?.message ?? "init failed");
  return created;
});

export const saveScraperConfigFn = createServerFn({ method: "POST" })
  .inputValidator((d: { sources: ScraperSources; keywords: string[] }) =>
    z
      .object({
        sources: z.object({
          facebook: z.boolean(),
          instagram: z.boolean(),
          google: z.boolean(),
          linkedin: z.boolean(),
        }),
        keywords: z.array(z.string().trim().min(1).max(80)).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("scraper_config")
      .update({ sources: data.sources, keywords: data.keywords, updated_at: new Date().toISOString() })
      .eq("singleton", true)
      .select("id,sources,keywords,updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "update failed");
    try {
      const { dispatchToN8n } = await import("@/lib/n8n.server");
      await dispatchToN8n({ type: "test", data: { action: "scraper_config_updated", config: row } });
    } catch { /* non-fatal */ }
    return row;
  });
