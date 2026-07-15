// Server functions for the dashboard: leads, my_portfolio, scraper_config.
// Portfolio + scraper config are per-user (RLS scoped); leads remain shared.
// Every new lead insert fires the outbound n8n webhook.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


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
    .select("id,title,description,source,contact,ai_pitch,business_proposal,raw_social_data,status,validation_status,processing_status,budget,urgency,tags,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Replace the tag list on a single lead.
export const updateLeadTagsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; tags: string[] }) =>
    z.object({
      id: z.string().uuid(),
      tags: z.array(z.string().trim().min(1).max(40)).max(20),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleaned = Array.from(new Set(data.tags.map((t) => t.toLowerCase())));
    const { error } = await supabaseAdmin.from("leads").update({ tags: cleaned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, tags: cleaned };
  });

// Edit the AI pitch and/or Pro Business Proposal text for a single lead.
export const updateLeadContentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ai_pitch?: string | null; business_proposal?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      ai_pitch: z.string().max(8000).nullable().optional(),
      business_proposal: z.string().max(20000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { ai_pitch?: string | null; business_proposal?: string | null } = {};
    if (data.ai_pitch !== undefined) patch.ai_pitch = data.ai_pitch;
    if (data.business_proposal !== undefined) patch.business_proposal = data.business_proposal;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bulk-set status and/or append tags across many leads. No AI, no outbound.
export const bulkUpdateLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; status?: LeadStatus; add_tags?: string[]; remove_tags?: string[] }) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      status: z.enum(LEAD_STATUSES).optional(),
      add_tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
      remove_tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const add = (data.add_tags ?? []).map((t) => t.toLowerCase());
    const remove = new Set((data.remove_tags ?? []).map((t) => t.toLowerCase()));
    let updated = 0;

    if (add.length || remove.size) {
      const { data: rows, error } = await supabaseAdmin
        .from("leads").select("id,tags").in("id", data.ids);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) {
        const next = Array.from(new Set([...(r.tags ?? []), ...add])).filter((t) => !remove.has(t));
        const patch: { tags: string[]; status?: LeadStatus } = { tags: next };
        if (data.status) patch.status = data.status;
        const { error: uErr } = await supabaseAdmin.from("leads").update(patch).eq("id", r.id);
        if (!uErr) updated += 1;
      }
    } else if (data.status) {
      const { error, count } = await supabaseAdmin
        .from("leads").update({ status: data.status }, { count: "exact" }).in("id", data.ids);
      if (error) throw new Error(error.message);
      updated = count ?? data.ids.length;
    }

    return { ok: true, updated };
  });

export const triggerGlobalScrapeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await context.supabase
    .from("scraper_config")
    .select("id,sources,keywords,intents,geo_target,max_results_per_query,n8n_webhook_url,updated_at")
    .eq("user_id", context.userId)
    .maybeSingle();
  const sources = (cfg?.sources ?? {}) as Record<string, boolean>;
  const intents = ((cfg?.intents ?? ["hiring", "freelance"]) as string[]);
  const geoTarget = (cfg?.geo_target ?? "global") as string;
  const maxPerQuery = Math.max(1, Math.min(50, Number(cfg?.max_results_per_query ?? 5)));
  const n8nUrl = (cfg?.n8n_webhook_url ?? null) as string | null;

  // Portfolio-driven queries — real data from THIS user's my_portfolio
  const { data: portfolio } = await context.supabase
    .from("my_portfolio")
    .select("category,content")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(20);


  const { jinaSearch, validateFromText, buildPortfolioQueries, applyIntentAndGeo } = await import("@/lib/scraper.server");

  const baseQueries = buildPortfolioQueries(portfolio ?? [], 3);
  if (baseQueries.length === 0) {
    return { ok: false, inserted: 0, queries: 0, errors: ["my_portfolio is empty — add skills/case studies to drive the scraper"] };
  }

  // Optionally scope by enabled sources
  const siteFilters: string[] = [];
  if (sources.facebook) siteFilters.push("site:facebook.com/groups");
  if (sources.instagram) siteFilters.push("site:instagram.com");
  if (sources.linkedin) siteFilters.push("site:linkedin.com/jobs");
  const useSiteScope = siteFilters.length > 0 && !sources.google;

  const rawQueries: string[] = [];
  for (const q of baseQueries) {
    if (!useSiteScope) rawQueries.push(q);
    for (const s of siteFilters) rawQueries.push(`${q} ${s}`);
  }

  // Apply intent modifiers and geo/platform constraints to every query
  const queries = applyIntentAndGeo(rawQueries, intents, geoTarget);

  let inserted = 0;
  let ignored = 0;
  const errors: string[] = [];
  for (const q of queries.slice(0, 24)) {
    const hits = await jinaSearch(q, maxPerQuery);

    for (const h of hits) {
      if (!h.url) continue;
      // Strict dedupe against existing leads by contact URL
      const { data: existing } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("contact", h.url)
        .maybeSingle();
      if (existing) continue;

      // 1) insert with scraping_profile
      const { data: row, error } = await supabaseAdmin
        .from("leads")
        .insert({
          title: h.title || q.slice(0, 120),
          description: (h.description || h.content || "").slice(0, 6000),
          source: "jina",
          contact: h.url,
          status: "pending",
          processing_status: "scraping_profile",
          validation_status: "pending",
        })
        .select("id,description")
        .single();
      if (error || !row) { errors.push(error?.message ?? "insert failed"); continue; }

      // 2) validate → validating_contact → success/failed
      await supabaseAdmin.from("leads").update({ processing_status: "validating_contact" }).eq("id", row.id);
      const v = await validateFromText(row.description ?? "", h.url);
      const verified = v.validation_status === "verified";
      await supabaseAdmin.from("leads").update({
        contact: v.contact ?? h.url,
        raw_social_data: v.raw_social_data as never,
        validation_status: v.validation_status,
        processing_status: verified ? "success" : "failed",
        // Safe execution: verified → pending (awaits manual "Generate Pro Proposal"); invalid → ignored
        status: verified ? "pending" : "ignored",
      }).eq("id", row.id);
      if (verified) inserted += 1; else ignored += 1;
    }
  }

  // Notify n8n workflow with scrape summary (per-user URL if set, else env fallback).
  try {
    const { dispatchToN8n } = await import("@/lib/n8n.server");
    await dispatchToN8n(
      {
        type: "test",
        data: {
          action: "trigger_live_scrape",
          config: { sources, intents, geo_target: geoTarget, max_results_per_query: maxPerQuery, keyword_count: baseQueries.length },
          result: { inserted, ignored, queries: queries.length },
        },
      },
      n8nUrl,
    );
  } catch { /* non-fatal */ }
  return { ok: true, inserted, ignored, queries: queries.length, errors: errors.slice(0, 5) };
});




// Enforce per-user daily tier limits. Throws "LIMIT_EXCEEDED" when the caller
// has already spent their daily quota. Reads from public.user_limits keyed by
// user_id; if no row exists we treat the user as unlimited (no-op).
async function assertWithinDailyLimit(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // user_limits may not be in generated types yet — cast through unknown.
  const client = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { daily_usage?: number; daily_limit?: number } | null; error: unknown }> };
      };
    };
  };
  const { data, error } = await client
    .from("user_limits")
    .select("daily_usage,daily_limit")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return;
  if (!data) return;
  const limit = Number(data.daily_limit ?? 0);
  const used = Number(data.daily_usage ?? 0);
  if (limit > 0 && used >= limit) {
    throw new Error("LIMIT_EXCEEDED");
  }
}


// AI proposal generation runs fully server-side via Lovable AI Gateway.
// Client calls via useServerFn + TanStack Query useMutation; env vars stay on server.
export const requestProposalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; force?: boolean }) =>
    z.object({ id: z.string().uuid(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertWithinDailyLimit(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("id,title,description,source,contact,ai_pitch,business_proposal,status,raw_social_data,budget,urgency")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("lead not found");

    // Duplicate / in-flight prevention (skippable with force)
    const alreadyHasProposal = Boolean(lead.business_proposal && String(lead.business_proposal).trim());
    const inFlight = lead.status === "generating";
    if (!data.force && (alreadyHasProposal || inFlight)) {
      return {
        ok: false,
        skipped: true,
        reason: alreadyHasProposal ? "duplicate_proposal" : "in_flight",
        status: lead.status,
      } as const;
    }

    await supabaseAdmin
      .from("leads")
      .update({ status: "generating", processing_status: "generating_pitch" })
      .eq("id", data.id);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      await supabaseAdmin
        .from("leads")
        .update({ status: "pending", processing_status: "failed" })
        .eq("id", data.id);
      throw new Error("Missing LOVABLE_API_KEY");
    }

    // Pull portfolio for grounded, portfolio-aware pitching
    let portfolioBlock = "(no portfolio provided)";
    try {
      const { data: pf } = await supabaseAdmin
        .from("my_portfolio")
        .select("category,content")
        .order("created_at", { ascending: false })
        .limit(12);
      if (pf && pf.length) {
        portfolioBlock = pf
          .map((p) => `- [${p.category}] ${String(p.content).slice(0, 400)}`)
          .join("\n");
      }
    } catch { /* non-fatal */ }

    let proposal = "";
    let pitch = "";
    try {
      const { generateText } = await import("ai");
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const model = createLovableAiGatewayProvider(key)("google/gemini-2.5-flash");

      const system = `You are an elite freelance business-development writer for an indie full-stack web developer.
You write outbound proposals that win paid work. No fluff, no "as an AI", no emojis unless requested.
Ground every claim in the developer's real portfolio; cite the most relevant 1-2 projects by name.`;

      const socialCtx = lead.raw_social_data ? JSON.stringify(lead.raw_social_data).slice(0, 1200) : "(none)";

      const prompt = `LEAD:
- Title: ${lead.title}
- Source: ${lead.source}
- Contact: ${lead.contact ?? "(unknown)"}
- Budget: ${lead.budget ?? "(unspecified)"}
- Urgency: ${lead.urgency ?? "Medium"}
- Description:
${lead.description ?? "(no description)"}
- Enriched social data: ${socialCtx}

DEVELOPER PORTFOLIO (ground your pitch in these — mention 1-2 by name):
${portfolioBlock}

Produce TWO outputs separated by the exact delimiter line "===PROPOSAL===".

PART 1 (short outbound pitch, <= 90 words, plain text, ready to paste in DM/email):
- Personalized opener referencing their specific need
- One concrete value proposition backed by a named portfolio project
- Clear low-friction CTA (15-min call or reply with scope)

Then the delimiter line "===PROPOSAL===".

PART 2 (full Pro Business Proposal, markdown, 250-450 words):
## Understanding
## Proposed Solution
## Deliverables (bullet list, 3-6 items)
## Timeline & Milestones
## Pricing (1-3 tiers with rough $ ranges)
## Why Me (reference 1-2 named portfolio projects)
## Next Step (concrete CTA)`;

      const { text } = await generateText({ model, system, prompt });
      const parts = text.split(/^={3,}PROPOSAL={3,}\s*$/m);
      pitch = (parts[0] ?? "").trim();
      proposal = (parts[1] ?? parts[0] ?? "").trim();
      if (!proposal) proposal = text.trim();
      if (!pitch) pitch = proposal.slice(0, 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("leads")
        .update({ status: "pending", processing_status: "failed" })
        .eq("id", data.id);
      throw new Error(`AI generation failed: ${msg}`);
    }

    const { error: upErr } = await supabaseAdmin
      .from("leads")
      .update({
        ai_pitch: pitch,
        business_proposal: proposal,
        status: "ready",
        processing_status: "success",
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    // Notify n8n (non-fatal)
    try {
      const { dispatchToN8n } = await import("@/lib/n8n.server");
      await dispatchToN8n({
        type: "lead.proposal_ready",
        data: { lead_id: lead.id, ai_pitch: pitch, business_proposal: proposal },
      });
    } catch { /* non-fatal */ }

    return {
      ok: true,
      skipped: false,
      status: "ready" as const,
      ai_pitch: pitch,
      business_proposal: proposal,
    };
  });

// DNS-based contact validation. Server-only: uses Google DNS-over-HTTPS via fetch.
export const validateContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertWithinDailyLimit(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("id,description,contact")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("lead not found");

    const { validateFromText } = await import("@/lib/scraper.server");
    const text = `${lead.description ?? ""}\n${lead.contact ?? ""}`.trim();
    const v = await validateFromText(text, null);

    const { error: upErr } = await supabaseAdmin
      .from("leads")
      .update({
        contact: v.contact ?? lead.contact,
        raw_social_data: v.raw_social_data,
        validation_status: v.validation_status,
        processing_status: v.validation_status === "verified" ? "validating_contact" : "failed",
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, validation_status: v.validation_status, contact: v.contact };
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
  .inputValidator((d: { input: string; contact?: string | null; raw_social_data?: Record<string, unknown> | null }) =>
    z.object({
      input: z.string().trim().min(3).max(8000),
      contact: z.string().max(2000).nullable().optional(),
      raw_social_data: z.record(z.string(), z.unknown()).nullable().optional(),
    }).parse(d),
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

    // client-parsed contact/raw_social_data override auto-detected values
    const finalContact = data.contact && data.contact.trim() ? data.contact.trim() : contact;
    const rawSocial = data.raw_social_data ?? null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insert as scraping_profile first, then validate → validating_contact → success/failed
    const initialContact = data.contact && data.contact.trim() ? data.contact.trim() : contact;
    const { data: row, error } = await supabaseAdmin
      .from("leads")
      .insert({
        title,
        description,
        source,
        contact: initialContact,
        raw_social_data: (data.raw_social_data ?? null) as never,
        status: "pending",
        validation_status: "pending",
        processing_status: "scraping_profile",
      })
      .select("id,title,description,source,contact,ai_pitch,status,validation_status,processing_status,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");

    await supabaseAdmin.from("leads").update({ processing_status: "validating_contact" }).eq("id", row.id);

    const { validateFromText } = await import("@/lib/scraper.server");
    const validationText = `${description ?? ""}\n${initialContact ?? ""}`;
    const v = await validateFromText(validationText, isUrl ? raw : null);
    const finalProcessing = v.validation_status === "verified" ? "success" : "failed";
    const finalStatus = v.validation_status === "verified" ? "pending" : "ignored";
    const { data: updated } = await supabaseAdmin
      .from("leads")
      .update({
        contact: v.contact ?? initialContact,
        raw_social_data: v.raw_social_data as never,
        validation_status: v.validation_status,
        processing_status: finalProcessing,
        status: finalStatus,
      })
      .eq("id", row.id)
      .select("id,title,description,source,contact,ai_pitch,status,validation_status,processing_status,created_at")
      .single();

    try {
      const { dispatchToN8n } = await import("@/lib/n8n.server");
      await dispatchToN8n({
        type: "lead.new",
        data: { action: "new_manual_lead", lead_data: updated ?? row },
      });
    } catch { /* non-fatal */ }

    return updated ?? row;
  });


export const listPortfolioFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("my_portfolio")
      .select("id,category,content,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addPortfolioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { category: string; content: string }) =>
    z.object({ category: z.string().min(1).max(120), content: z.string().min(1).max(8000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("my_portfolio")
      .insert({ ...data, user_id: context.userId })
      .select("id,category,content,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return row;
  });

export const updatePortfolioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; category: string; content: string }) =>
    z
      .object({
        id: z.string().uuid(),
        category: z.string().min(1).max(120),
        content: z.string().min(1).max(8000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("my_portfolio")
      .update({ category: data.category, content: data.content })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id,category,content,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "update failed");
    return row;
  });

export const deletePortfolioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("my_portfolio")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Scraper config (per-user) ----------
export type ScraperSources = {
  facebook: boolean;
  instagram: boolean;
  google: boolean;
  linkedin: boolean;
};

export const LEAD_INTENTS = ["hiring", "freelance", "pain_points"] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];
export const GEO_TARGETS = ["global", "remote", "thailand", "usa", "europe"] as const;
export type GeoTarget = (typeof GEO_TARGETS)[number];

const SCRAPER_COLS = "id,sources,keywords,intents,geo_target,max_results_per_query,n8n_webhook_url,updated_at";

export const getScraperConfigFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scraper_config")
      .select(SCRAPER_COLS)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;
    const { data: created, error: insErr } = await context.supabase
      .from("scraper_config")
      .insert({ user_id: context.userId })
      .select(SCRAPER_COLS)
      .single();
    if (insErr || !created) throw new Error(insErr?.message ?? "init failed");
    return created;
  });

export const saveScraperConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    sources: ScraperSources;
    keywords: string[];
    intents: LeadIntent[];
    geo_target: GeoTarget;
    max_results_per_query: number;
    n8n_webhook_url?: string | null;
  }) =>
    z
      .object({
        sources: z.object({
          facebook: z.boolean(),
          instagram: z.boolean(),
          google: z.boolean(),
          linkedin: z.boolean(),
        }),
        keywords: z.array(z.string().trim().min(1).max(80)).max(50),
        intents: z.array(z.enum(LEAD_INTENTS)).max(LEAD_INTENTS.length),
        geo_target: z.enum(GEO_TARGETS),
        max_results_per_query: z.number().int().min(1).max(50),
        n8n_webhook_url: z
          .string()
          .trim()
          .max(500)
          .url()
          .nullable()
          .optional()
          .or(z.literal("").transform(() => null)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scraper_config")
      .upsert(
        {
          user_id: context.userId,
          sources: data.sources,
          keywords: data.keywords,
          intents: data.intents,
          geo_target: data.geo_target,
          max_results_per_query: data.max_results_per_query,
          n8n_webhook_url: data.n8n_webhook_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select(SCRAPER_COLS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "save failed");
    return row;
  });

// Test the configured n8n webhook (per-user URL if set, else env fallback)
export const testN8nWebhookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cfg } = await context.supabase
      .from("scraper_config")
      .select("n8n_webhook_url")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { dispatchToN8n } = await import("@/lib/n8n.server");
    return dispatchToN8n(
      { type: "test", data: { from: "scraper_panel", at: new Date().toISOString() } },
      cfg?.n8n_webhook_url ?? null,
    );
  });

