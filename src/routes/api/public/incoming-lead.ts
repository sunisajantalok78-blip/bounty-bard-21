import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const NOTIFY_EMAIL = "sunisajantalok78@gmail.com";

const LeadPayload = z.object({
  source: z.string().min(1).max(64).default("webhook"),
  title: z.string().min(1).max(500),
  budget: z.union([z.number(), z.string()]).optional(),
  urgency: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  description: z.string().max(8000).optional(),
  contact: z.string().max(500).optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

async function tryEmail(lead: {
  id: string;
  source: string;
  title: string;
  budget: number | null;
  urgency: string;
  description?: string;
  contact?: string;
}) {
  // Best-effort: only works once the user completes the Lovable Emails setup
  // (transactional template scaffolded as `new-lead-alert`). Until then we
  // silently skip — the lead is still stored and visible in the dashboard.
  try {
    const origin =
      process.env.VITE_APP_URL ||
      `https://project--e9580fa5-13a7-457e-975e-91b30a207a34.lovable.app`;
    const res = await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // service-role auth so the call works without a user JWT
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
    return { sent: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export const Route = createFileRoute("/api/public/incoming-lead")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            endpoint: "/api/public/incoming-lead",
            method: "POST",
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
          { headers: { "content-type": "application/json", ...cors } },
        ),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400,
            headers: { "content-type": "application/json", ...cors },
          });
        }

        const parsed = LeadPayload.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "validation_failed", details: parsed.error.flatten() }),
            { status: 400, headers: { "content-type": "application/json", ...cors } },
          );
        }
        const data = parsed.data;
        const budget =
          typeof data.budget === "string" ? Number(data.budget.replace(/[^0-9.]/g, "")) : data.budget;

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
          return new Response(
            JSON.stringify({ error: "db_error", message: error?.message }),
            { status: 500, headers: { "content-type": "application/json", ...cors } },
          );
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

        return new Response(
          JSON.stringify({ ok: true, id: inserted.id, email: mail }),
          { status: 200, headers: { "content-type": "application/json", ...cors } },
        );
      },
    },
  },
});
