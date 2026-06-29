import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const Input = z.object({
  messages: z.array(Message).min(1).max(40),
  plan: z.unknown().optional(),
  profile: z
    .object({
      name: z.string().optional().default(""),
      role: z.string().optional().default(""),
      links: z.record(z.string(), z.string()).optional().default({}),
      portfolio: z.string().optional().default(""),
      goals: z.string().optional().default(""),
    })
    .optional(),
  progress: z
    .object({
      completed_tasks: z
        .array(
          z.object({
            day: z.string().optional().default(""),
            task: z.string(),
            done_at: z.string().optional().default(""),
          }),
        )
        .optional()
        .default([]),
      pending_tasks: z
        .array(
          z.object({
            day: z.string().optional().default(""),
            task: z.string(),
          }),
        )
        .optional()
        .default([]),
      link_progress: z
        .record(
          z.string(),
          z.object({
            last_checked_at: z.string().optional().default(""),
            summary: z.string().optional().default(""),
          }),
        )
        .optional()
        .default({}),
      notes: z.string().optional().default(""),
      audit_history: z
        .array(
          z.object({
            at: z.string().optional().default(""),
            audit: z.unknown(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional(),
});

export const chatWithMarketingBot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const profile = data.profile ?? { name: "", role: "", links: {}, portfolio: "", goals: "" };
    const planSnippet = data.plan ? JSON.stringify(data.plan).slice(0, 6000) : "(no plan generated yet)";

    const progress = data.progress;
    const completed = progress?.completed_tasks ?? [];
    const pending = progress?.pending_tasks ?? [];
    const linkProg = progress?.link_progress ?? {};
    const totalTasks = completed.length + pending.length;
    const progressBlock = progress
      ? `CURRENT EXECUTION STATE (this is the source of truth — DO NOT re-suggest things already done):
- Tasks completed: ${completed.length} / ${totalTasks}
- Completed:
${completed.map((t) => `  ✓ [${t.day}] ${t.task}${t.done_at ? ` (done ${t.done_at})` : ""}`).join("\n") || "  (none yet)"}
- Still pending:
${pending.map((t) => `  ☐ [${t.day}] ${t.task}`).join("\n") || "  (none)"}
- Per-profile progress notes (from previous re-checks):
${
  Object.keys(linkProg).length
    ? Object.entries(linkProg)
        .map(([k, v]) => `  • ${k} (checked ${v.last_checked_at || "?"}): ${(v.summary || "").slice(0, 600)}`)
        .join("\n")
    : "  (no previous re-checks)"
}
- Free-form notes from operator: ${progress.notes || "(none)"}`
      : "CURRENT EXECUTION STATE: (no progress tracked yet)";

    const system = `You are the user's personal AI MARKETING COACH + FREELANCE GROWTH STRATEGIST.
You already produced this marketing plan for them:

${planSnippet}

DEVELOPER CONTEXT:
- Name: ${profile.name || "(unknown)"}
- Role: ${profile.role || "(unknown)"}
- Goals: ${profile.goals || "(unknown)"}
- Links: ${JSON.stringify(profile.links || {})}
- Portfolio:
${profile.portfolio || "(none)"}

${progressBlock}

HOW YOU BEHAVE:
- Be hyper-helpful and proactive. Don't wait to be asked — anticipate the next step.
- ALWAYS account for what is already DONE vs PENDING above. Never tell the user to do a task they already checked off.
- Build on previous per-profile re-checks; treat them as memory of the current state of each profile/business.
- Give CONCRETE, step-by-step instructions ("Do X, then Y, here is the exact copy/paste…").
- When the user asks vague questions, give the best answer first, THEN ask 1–2 sharp follow-up questions to refine.
- Always end with a clear NEXT ACTION the user should take (numbered, time-boxed).
- Reference the plan above when relevant (specific day, specific post, specific milestone).
- Use markdown: short paragraphs, **bold** key actions, bullet/numbered lists, code fences for copy-paste text.
- No fluff. No "as an AI". No emojis unless asked.
- If the user seems stuck, suggest the single highest-leverage move and offer to draft it for them.`;

    const promptMessages = data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const { text } = await generateText({
      model,
      system,
      messages: promptMessages,
    });

    return { text };
  });
