import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/user-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { dispatchToN8n } = await import("@/lib/n8n.server");
          await dispatchToN8n({
            type: "test",
            data: { event: body?.event ?? "user.event", email: body?.email ?? null, at: new Date().toISOString() },
          });
        } catch {
          /* non-fatal */
        }
        return Response.json({ ok: true });
      },
    },
  },
});
