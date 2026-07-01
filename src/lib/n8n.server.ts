// Outbound n8n dispatcher. Server-only.
// POSTs JSON to N8N_WEBHOOK_URL and logs every attempt in the user's
// Supabase (n8n_events table) so you can audit what fired.

export type N8nEvent =
  | { type: "lead.new"; data: unknown }
  | { type: "lead.updated"; data: unknown }
  | { type: "pitch.sent"; data: unknown }
  | { type: "task.completed"; data: unknown }
  | { type: "plan.generated"; data: unknown }
  | { type: "audit.refreshed"; data: unknown }
  | { type: "test"; data: unknown };

export async function dispatchToN8n(event: N8nEvent): Promise<{
  ok: boolean;
  status?: number;
  response?: string | null;
  error?: string;
}> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return { ok: false, error: "N8N_WEBHOOK_URL not configured" };

  const payload = {
    event: event.type,
    sent_at: new Date().toISOString(),
    source: "bounty-hunter-dashboard",
    data: event.data,
  };

  let status: number | undefined;
  let response: string | null = null;
  let ok = false;
  let error: string | undefined;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "bypass-tunnel-reminder": "1",
        "User-Agent": "bounty-hunter/1.0",
      },
      body: JSON.stringify(payload),
    });
    status = res.status;
    ok = res.ok;
    response = (await res.text()).slice(0, 800);
    if (!ok) error = `n8n ${status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "unknown";
  }

  // Log to user's Supabase (best-effort)
  try {
    const { getUserSupabase } = await import("@/integrations/user-supabase/client.server");
    const sb = getUserSupabase();
    if (sb) {
      await sb.from("n8n_events").insert({
        event_type: event.type,
        payload: payload as never,
        status: ok ? "ok" : "error",
        response: response as never,
        error: error ?? null,
      });
    }
  } catch {
    /* non-fatal */
  }

  return { ok, status, response, error };
}
