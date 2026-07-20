// Server functions for the enterprise multi-tenant layer:
// organizations, members, invitations, credit ledger, lead batches,
// and the async processing tick that drains queued leads.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- Types ---------- */
export type OrgRole = "admin" | "member";
export type BatchStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type LeadProcStatus =
  | "pending" | "scraping" | "analyzing" | "completed" | "failed";

export type Organization = {
  id: string; name: string; owner_id: string; plan: string;
  ai_key_mode: "platform" | "byok";
  credits_pool: number; credits_used: number;
  created_at: string;
};

export type OrgMember = {
  id: string; organization_id: string; user_id: string; role: OrgRole;
  credits_allocated: number; credits_used: number; email?: string | null;
};

export type LeadBatch = {
  id: string; organization_id: string; uploaded_by: string; filename: string;
  total: number; processed: number; failed: number; status: BatchStatus;
  error: string | null; created_at: string; updated_at: string;
};

/* ---------- Helpers ---------- */
function admin() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin as unknown as {
    from: (t: string) => any;
  });
}

/* ---------- Org fns ---------- */

export const listMyOrganizationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { data: members, error: memErr } = await c
      .from("organization_members")
      .select("organization_id,role,credits_allocated,credits_used")
      .eq("user_id", context.userId);
    if (memErr) throw new Error(memErr.message);
    if (!members?.length) return { organizations: [] as (Organization & { role: OrgRole; credits_allocated: number; credits_used: number })[] };
    const ids = members.map((m: any) => m.organization_id);
    const { data: orgs, error: orgErr } = await c
      .from("organizations")
      .select("id,name,owner_id,plan,ai_key_mode,credits_pool,credits_used,created_at")
      .in("id", ids);
    if (orgErr) throw new Error(orgErr.message);
    return {
      organizations: (orgs ?? []).map((o: any) => {
        const m = members.find((mm: any) => mm.organization_id === o.id);
        return { ...o, role: m?.role ?? "member", credits_allocated: m?.credits_allocated ?? 0, credits_used: m?.credits_used ?? 0 };
      }),
    };
  });

export const createOrganizationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { data: row, error } = await c
      .from("organizations")
      .insert({ name: data.name, owner_id: context.userId, plan: "free", credits_pool: 1000 })
      .select("id,name")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, name: row.name as string };
  });

/* ---------- Members ---------- */

export const listOrgMembersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { data: rows, error } = await c
      .from("organization_members")
      .select("id,organization_id,user_id,role,credits_allocated,credits_used,created_at")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const allocateCreditsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; credits: number }) =>
    z.object({ memberId: z.string().uuid(), credits: z.number().int().min(0).max(1_000_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { error } = await c
      .from("organization_members")
      .update({ credits_allocated: data.credits })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMemberRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; role: OrgRole }) =>
    z.object({ memberId: z.string().uuid(), role: z.enum(["admin", "member"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { error } = await c.from("organization_members").update({ role: data.role }).eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Invitations ---------- */

export const inviteMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; email: string; role: OrgRole }) =>
    z.object({
      orgId: z.string().uuid(),
      email: z.string().email().max(255).toLowerCase(),
      role: z.enum(["admin", "member"]).default("member"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { data: row, error } = await c
      .from("invitations")
      .insert({ organization_id: data.orgId, email: data.email, role: data.role, invited_by: context.userId })
      .select("id,token")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, token: row.token as string };
  });

export const listInvitationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { data: rows, error } = await c
      .from("invitations")
      .select("id,email,role,token,accepted_at,expires_at,created_at")
      .eq("organization_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const acceptInvitationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(10).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await admin();
    const { data: inv, error } = await a.from("invitations")
      .select("id,organization_id,role,expires_at,accepted_at")
      .eq("token", data.token).maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitation not found");
    if (inv.accepted_at) throw new Error("Invitation already accepted");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitation expired");
    const { error: insErr } = await a.from("organization_members").insert({
      organization_id: inv.organization_id, user_id: context.userId, role: inv.role,
    });
    if (insErr && !String(insErr.message).includes("duplicate")) throw new Error(insErr.message);
    await a.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
    return { ok: true, orgId: inv.organization_id as string };
  });

/* ---------- Batches ---------- */

const BulkRowSchema = z.object({
  domain: z.string().trim().max(255).optional(),
  company_name: z.string().trim().max(255).optional(),
  title: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(500).optional(),
  description: z.string().trim().max(4000).optional(),
});
type BulkRow = z.infer<typeof BulkRowSchema>;

export const uploadBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; filename: string; rows: BulkRow[] }) =>
    z.object({
      orgId: z.string().uuid(),
      filename: z.string().trim().min(1).max(255),
      rows: z.array(BulkRowSchema).min(1).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };

    // Verify membership (RLS enforces too)
    const { data: mem } = await c
      .from("organization_members")
      .select("id")
      .eq("organization_id", data.orgId).eq("user_id", context.userId).maybeSingle();
    if (!mem) throw new Error("Not a member of this organization");

    // Insert batch row
    const { data: batch, error: bErr } = await c
      .from("lead_batches")
      .insert({
        organization_id: data.orgId,
        uploaded_by: context.userId,
        filename: data.filename,
        total: data.rows.length,
        status: "queued",
      })
      .select("id")
      .single();
    if (bErr) throw new Error(bErr.message);
    const batchId = batch.id as string;

    // Normalize + insert leads in chunks of 200
    const nowIso = new Date().toISOString();
    const leadRows = data.rows.map((r) => {
      const title =
        r.title?.trim() || r.company_name?.trim() || r.domain?.trim() || "Untitled lead";
      return {
        organization_id: data.orgId,
        batch_id: batchId,
        user_id: context.userId,
        title,
        description: r.description ?? null,
        contact: r.contact ?? null,
        domain: r.domain ?? null,
        company_name: r.company_name ?? null,
        source: "bulk_upload",
        status: "pending",
        processing_status: "pending",
        validation_status: "pending",
        created_at: nowIso,
      };
    });

    const a = await admin();
    let inserted = 0;
    for (let i = 0; i < leadRows.length; i += 200) {
      const chunk = leadRows.slice(i, i + 200);
      const { error } = await a.from("leads").insert(chunk);
      if (error) throw new Error(error.message);
      inserted += chunk.length;
    }
    return { ok: true, batchId, inserted };
  });

export const listBatchesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { data: rows, error } = await c
      .from("lead_batches")
      .select("id,filename,total,processed,failed,status,created_at,updated_at")
      .eq("organization_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getBatchFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string }) => z.object({ batchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const { data: batch, error } = await c
      .from("lead_batches")
      .select("id,organization_id,filename,total,processed,failed,status,error,created_at,updated_at")
      .eq("id", data.batchId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!batch) throw new Error("Batch not found");
    const { data: leads, error: lErr } = await c
      .from("leads")
      .select("id,title,contact,domain,company_name,status,processing_status,validation_status,ai_pitch,business_proposal,created_at,updated_at")
      .eq("batch_id", data.batchId)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (lErr) throw new Error(lErr.message);
    return { batch, leads: leads ?? [] };
  });

/* ---------- Async processing tick ---------- */

// Called on a timer (client every 3s while viewing a batch, or by cron).
// Picks up to N pending leads for the batch, runs a lightweight processing
// pipeline, and updates status.
export const processBatchTickFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { batchId: string; take?: number }) =>
    z.object({ batchId: z.string().uuid(), take: z.number().int().min(1).max(20).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const a = await admin();

    // Fetch batch
    const { data: batch, error: bErr } = await a
      .from("lead_batches")
      .select("id,status,total,processed,failed,organization_id")
      .eq("id", data.batchId).maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!batch) throw new Error("Batch not found");
    if (batch.status === "completed" || batch.status === "cancelled") return { ok: true, done: true };

    // Pick next pending leads for this batch
    const take = data.take ?? 5;
    const { data: pending, error: pErr } = await a
      .from("leads")
      .select("id,title,contact,domain,description")
      .eq("batch_id", data.batchId)
      .eq("processing_status", "pending")
      .limit(take);
    if (pErr) throw new Error(pErr.message);

    if (!pending || pending.length === 0) {
      // Nothing left → close batch
      const isDone = (batch.processed + batch.failed) >= batch.total;
      if (isDone && batch.status !== "completed") {
        await a.from("lead_batches").update({ status: "completed" }).eq("id", data.batchId);
      }
      return { ok: true, done: isDone, processed: 0 };
    }

    // Mark as processing
    if (batch.status === "queued") {
      await a.from("lead_batches").update({ status: "processing" }).eq("id", data.batchId);
    }

    let processed = 0;
    let failed = 0;

    for (const lead of pending) {
      // Step 1: scraping
      await a.from("leads").update({ processing_status: "scraping" }).eq("id", lead.id);

      // Cheap "scrape": if we have a domain, synthesize a description; otherwise skip real scrape
      const domain = (lead.domain ?? "").toString().trim();
      let scraped = (lead.description ?? "").toString();
      if (domain && !scraped) {
        scraped = `Business at ${domain}. Publicly available information will be enriched during outreach.`;
      }

      // Step 2: analyzing
      await a.from("leads").update({ processing_status: "analyzing", description: scraped || null }).eq("id", lead.id);

      // Cheap deterministic "AI pitch" so batches complete even without LLM credits.
      // Real proposals are produced by the existing requestProposalFn on demand.
      const brand = (lead.title || domain || "your company").toString();
      const pitch = `Hi ${brand} team,\n\nQuick idea: I build AI-driven web automation that turns lead scraping, proposal writing, and CRM sync into a single dashboard. Happy to send a 90-second Loom showing exactly what this would look like for ${brand}.\n\n— Bahdan`;

      const { error: uErr } = await a
        .from("leads")
        .update({
          processing_status: "completed",
          status: "ready",
          ai_pitch: pitch,
        })
        .eq("id", lead.id);
      if (uErr) { failed += 1; await a.from("leads").update({ processing_status: "failed", status: "ignored" }).eq("id", lead.id); }
      else processed += 1;
    }

    // Update batch counters
    const newProcessed = (batch.processed ?? 0) + processed;
    const newFailed = (batch.failed ?? 0) + failed;
    const isDone = (newProcessed + newFailed) >= batch.total;
    await a.from("lead_batches").update({
      processed: newProcessed,
      failed: newFailed,
      status: isDone ? "completed" : "processing",
    }).eq("id", data.batchId);

    return { ok: true, done: isDone, processed, failed };
  });

/* ---------- Enterprise metrics ---------- */

export const getEnterpriseMetricsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = context.supabase as unknown as { from: (t: string) => any };
    const [{ count: total }, { count: completed }, { count: active }, { data: org }] = await Promise.all([
      c.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", data.orgId),
      c.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", data.orgId).in("status", ["ready", "won", "sent"]),
      c.from("lead_batches").select("id", { count: "exact", head: true }).eq("organization_id", data.orgId).in("status", ["queued", "processing"]),
      c.from("organizations").select("credits_pool,credits_used").eq("id", data.orgId).maybeSingle(),
    ]);
    return {
      totalLeads: total ?? 0,
      matches: completed ?? 0,
      activeBatches: active ?? 0,
      creditsRemaining: Math.max(0, (org?.credits_pool ?? 0) - (org?.credits_used ?? 0)),
    };
  });

/* ---------- CRM export stubs ---------- */

export const exportToCrmFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; leadIds: string[]; provider: "hubspot" | "salesforce" | "instantly" | "lemlist" }) =>
    z.object({
      orgId: z.string().uuid(),
      leadIds: z.array(z.string().uuid()).min(1).max(500),
      provider: z.enum(["hubspot", "salesforce", "instantly", "lemlist"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    // Stub — a real integration would POST to the provider's API here.
    // Downstream teams can wire connector credentials (HubSpot/Salesforce) later.
    return { ok: true, provider: data.provider, exported: data.leadIds.length, note: "Queued for CRM push (stub)" };
  });
