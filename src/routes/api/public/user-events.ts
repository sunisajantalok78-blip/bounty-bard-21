import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, readBoundedText, requireSharedSecret } from "@/lib/http.server";
import { logError } from "@/lib/log.server";
import { UserEventSchema } from "@/lib/schemas";

export const Route = createFileRoute("/api/public/user-events")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        const auth = requireSharedSecret(request, "INCOMING_LEAD_SECRET");
        if (auth) return auth;

        const raw = await readBoundedText(request, 4 * 1024);
        if (raw === null) return json({ error: "payload_too_large" }, 413);

        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const parsed = UserEventSchema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "validation_failed", details: parsed.error.flatten() }, 400);
        }

        try {
          const { dispatchToN8n } = await import("@/lib/n8n.server");
          await dispatchToN8n({
            type: "test",
            data: { event: parsed.data.event, ref: parsed.data.ref ?? null, at: new Date().toISOString() },
          });
        } catch (e) {
          logError("user-events.dispatch", e);
        }
        return json({ ok: true });
      },
    },
  },
});
