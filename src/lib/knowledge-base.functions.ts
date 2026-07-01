// Client-callable server functions for the knowledge base + n8n dispatcher.
// Uses the user's own Supabase (USER_SUPABASE_*) for durable storage.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ---------- n8n test ping ---------- */

export const sendTestToN8n = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ note: z.string().max(500).optional().default("Manual test from dashboard") })
      .parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { dispatchToN8n } = await import("./n8n.server");
    return dispatchToN8n({ type: "test", data: { note: data.note } });
  });

/* ---------- Generic outbound event ---------- */

const EventInput = z.object({
  type: z.enum([
    "lead.new",
    "lead.updated",
    "pitch.sent",
    "task.completed",
    "plan.generated",
    "audit.refreshed",
    "test",
  ]),
  data: z.unknown(),
});

export const dispatchEvent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => EventInput.parse(i))
  .handler(async ({ data }) => {
    const { dispatchToN8n } = await import("./n8n.server");
    return dispatchToN8n({ type: data.type, data: data.data } as never);
  });

/* ---------- Sync (persist) a chat turn to user's Supabase ---------- */

const ChatTurnInput = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(20000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const saveChatTurn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ChatTurnInput.parse(i))
  .handler(async ({ data }) => {
    const { getUserSupabase } = await import("@/integrations/user-supabase/client.server");
    const sb = getUserSupabase();
    if (!sb) return { ok: false, error: "user_supabase_not_configured" };
    const { error } = await sb.from("chat_messages").insert({
      role: data.role,
      content: data.content,
      metadata: (data.metadata ?? null) as never,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  });

/* ---------- Save an audit snapshot ---------- */

const AuditInput = z.object({
  platform: z.string().min(1).max(64),
  url: z.string().max(500).optional(),
  score: z.number().optional(),
  audit: z.unknown(),
  reason: z.string().max(200).optional(),
});

export const saveAuditSnapshot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AuditInput.parse(i))
  .handler(async ({ data }) => {
    const { getUserSupabase } = await import("@/integrations/user-supabase/client.server");
    const sb = getUserSupabase();
    if (!sb) return { ok: false, error: "user_supabase_not_configured" };
    const { error } = await sb.from("audit_snapshots").insert({
      platform: data.platform,
      url: data.url ?? null,
      score: data.score ?? null,
      audit: (data.audit ?? null) as never,
      reason: data.reason ?? null,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  });

/* ---------- Upsert a task (from plan or chat) ---------- */

const TaskInput = z.object({
  id: z.string().optional(),
  day: z.string().optional(),
  task: z.string().min(1),
  why: z.string().optional(),
  time_of_day: z.string().optional(),
  completed: z.boolean().optional(),
  source: z.enum(["plan", "chat", "manual"]).optional(),
});

export const upsertTask = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TaskInput.parse(i))
  .handler(async ({ data }) => {
    const { getUserSupabase } = await import("@/integrations/user-supabase/client.server");
    const sb = getUserSupabase();
    if (!sb) return { ok: false, error: "user_supabase_not_configured" };
    const row = {
      day: data.day ?? null,
      task: data.task,
      why: data.why ?? null,
      time_of_day: data.time_of_day ?? null,
      completed: data.completed ?? false,
      completed_at: data.completed ? new Date().toISOString() : null,
      source: data.source ?? "plan",
    };
    const q = data.id
      ? sb.from("tasks").update(row).eq("id", data.id).select("id").single()
      : sb.from("tasks").insert(row).select("id").single();
    const { data: out, error } = await q;
    if (error) return { ok: false, error: error.message };

    // Fire outbound n8n event when marking complete
    if (data.completed) {
      const { dispatchToN8n } = await import("./n8n.server");
      await dispatchToN8n({ type: "task.completed", data: { id: out?.id, ...row } });
    }
    return { ok: true, id: out?.id };
  });

/* ---------- Learn / confirm a knowledge-base fact ---------- */

const KBInput = z.object({
  topic: z.string().min(1).max(120),
  fact: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.unknown().optional(),
  confirmed: z.boolean().optional(),
});

export const learnFact = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => KBInput.parse(i))
  .handler(async ({ data }) => {
    const { getUserSupabase } = await import("@/integrations/user-supabase/client.server");
    const sb = getUserSupabase();
    if (!sb) return { ok: false, error: "user_supabase_not_configured" };
    const { data: out, error } = await sb
      .from("knowledge_base")
      .insert({
        topic: data.topic,
        fact: data.fact,
        confidence: data.confidence ?? 0.6,
        evidence: (data.evidence ?? null) as never,
        confirmed: data.confirmed ?? false,
      })
      .select("id")
      .single();
    return error ? { ok: false, error: error.message } : { ok: true, id: out?.id };
  });

/* ---------- Health check ---------- */

export const checkIntegrations = createServerFn({ method: "GET" }).handler(async () => {
  const { isUserSupabaseConfigured, getUserSupabase } = await import(
    "@/integrations/user-supabase/client.server"
  );
  const sb = getUserSupabase();
  let supabase_ok = false;
  let supabase_error: string | undefined;
  if (sb) {
    const { error } = await sb.from("knowledge_base").select("id", { head: true, count: "exact" });
    supabase_ok = !error;
    if (error) supabase_error = error.message;
  }
  return {
    supabase_configured: isUserSupabaseConfigured(),
    supabase_ok,
    supabase_error,
    n8n_configured: Boolean(process.env.N8N_WEBHOOK_URL),
  };
});
