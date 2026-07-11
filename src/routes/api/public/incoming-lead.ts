import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, readBoundedText, requireSharedSecret } from "@/lib/http.server";
import { logError, logInfo } from "@/lib/log.server";
import { LeadPayloadSchema } from "@/lib/schemas";

const NOTIFY_EMAIL = "sunisajantalok78@gmail.com";

async function tryEmail(lead: {
  id: string;
  source: string;
  title: string;
  budget: number | null;
  urgency: string;
  description?: string;
  contact?: string;
}) {
  const origin = process.env.APP_ORIGIN;
  if (!origin) {
    logInfo("incoming-lead", "APP_ORIGIN unset; skipping email notification");
    return { sent: false, error: "APP_ORIGIN unset" };
  }
  try {
    const res = await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      },
      body: JSON.stringify({
        templateName: "new-lead-alert",
        recipientEmail: NOTIFY_EMAIL,
        idempotencyKey: `lead-${lead.id}`,
        templateData: lead,
      }),
    });
    if (!res.ok) return { sent: false, error: `email ${res.status}` };
    return { sent: true, error: null as string | null };
  } catch (e) {
    logError("incoming-lead.email", e);
    return { sent: false, error: "email_dispatch_failed" };
  }
}

export const Route = createFileRoute("/api/public/incoming-lead")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async () =>
        json({
          ok: true,
          endpoint: "/api/public/incoming-lead",
          method: "POST",
          auth: "Send header `x-webhook-secret: <INCOMING_LEAD_SECRET>`",
          schema: {
            source: "string (e.g. GitHub, LinkedIn)",
            title: "string (required)",
            budget: "number | string (optional)",
            urgency: "Low | Medium | High | Critical",
            description: "string (optional)",
            contact: "string (optional, email or url)",
          },
          notify_email: NOTIFY_EMAIL,
        }),
      POST: async ({ request }) => {
        const auth = requireSharedSecret(request, "INCOMING_LEAD_SECRET");
        if (auth) return auth;

        const raw = await readBoundedText(request);
        if (raw === null) return json({ error: "payload_too_large" }, 413);

        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const parsed = LeadPayloadSchema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "validation_failed", details: parsed.error.flatten() }, 400);
        }
        const data = parsed.data;
        const budget =
          typeof data.budget === "string"
            ? Number(data.budget.replace(/[^0-9.]/g, ""))
            : data.budget;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: inserted, error } = await supabaseAdmin
          .from("leads")
          .insert({
            source: data.source,
            title: data.title,
            budget: Number.isFinite(budget as number) ? (budget as number) : null,
            urgency: data.urgency,
            description: data.description ?? null,
            contact: data.contact ?? null,
            raw: body as never,
          })
          .select("id")
          .single();

        if (error || !inserted) {
          logError("incoming-lead.insert", error);
          return json({ error: "db_error" }, 500);
        }

        const mail = await tryEmail({
          id: inserted.id,
          source: data.source,
          title: data.title,
          budget: Number.isFinite(budget as number) ? (budget as number) : null,
          urgency: data.urgency,
          description: data.description,
          contact: data.contact,
        });

        await supabaseAdmin
          .from("leads")
          .update({ email_sent: mail.sent, email_error: mail.error })
          .eq("id", inserted.id);

        let n8n: { ok: boolean; status?: number; error?: string } = { ok: false };
        try {
          const { dispatchToN8n } = await import("@/lib/n8n.server");
          const r = await dispatchToN8n({
            type: "lead.new",
            data: { id: inserted.id, ...data, budget },
          });
          n8n = { ok: r.ok, status: r.status, error: r.error };
        } catch (e) {
          logError("incoming-lead.n8n", e);
          n8n = { ok: false, error: "dispatch_failed" };
        }

        return json({ ok: true, id: inserted.id, email: mail, n8n });
      },
    },
  },
});
