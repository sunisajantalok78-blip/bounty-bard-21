import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const Input = z.object({
  profileLinks: z.object({
    facebook: z.string().optional().default(""),
    linkedin: z.string().optional().default(""),
    fiverr: z.string().optional().default(""),
    github: z.string().optional().default(""),
    other: z.string().optional().default(""),
  }),
  goals: z.string().max(2000).optional().default(""),
  portfolio: z.string().max(6000).optional().default(""),
});

export const generateMarketingPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are an elite freelance growth strategist + marketing automation bot for an indie web developer.
You analyze the developer's public profiles (Facebook, LinkedIn, Fiverr, GitHub, etc) and produce a concrete,
high-conversion plan to win paid client work in the next 14 days.

Return STRICT JSON only, matching exactly this TypeScript shape (no markdown, no commentary):

{
  "summary": string,                       // 2-3 sentence executive summary
  "profile_audit": [                       // observations per platform link the user provided
    { "platform": string, "url": string, "score": number, "strengths": string[], "weaknesses": string[], "fix_now": string[] }
  ],
  "daily_actions": [                       // 7 days of concrete actions
    { "day": string, "focus": string, "tasks": [ { "time": string, "task": string, "why": string } ] }
  ],
  "post_drafts": [                         // ready-to-publish copy per platform
    { "platform": "LinkedIn" | "Facebook" | "Fiverr" | "Twitter/X", "hook": string, "body": string, "cta": string, "hashtags": string[], "image_prompt": string }
  ],
  "income_forecast": {
    "week_1_low_usd": number, "week_1_high_usd": number,
    "month_1_low_usd": number, "month_1_high_usd": number,
    "quarter_1_low_usd": number, "quarter_1_high_usd": number,
    "assumptions": string[]
  },
  "next_milestones": [ { "when": string, "milestone": string, "expected_usd": number } ]
}`;

    const user = `DEVELOPER PROFILE LINKS:
- Facebook:  ${data.profileLinks.facebook || "(none)"}
- LinkedIn:  ${data.profileLinks.linkedin || "(none)"}
- Fiverr:    ${data.profileLinks.fiverr || "(none)"}
- GitHub:    ${data.profileLinks.github || "(none)"}
- Other:     ${data.profileLinks.other || "(none)"}

GOALS:
${data.goals || "(not specified — assume: maximize paid freelance income in next 30 days, EU/SEA timezone)"}

PORTFOLIO SNAPSHOT:
${data.portfolio || "(not provided)"}

Now produce the JSON plan. Be specific (real timeframes, real $ figures, real post copy a human can paste in).`;

    const { text } = await generateText({
      model,
      system,
      prompt: user,
    });

    // Extract JSON (model sometimes wraps in ```json)
    const jsonStr = (() => {
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) return m[1].trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) return text.slice(start, end + 1);
      return text;
    })();

    let plan: unknown;
    try {
      plan = JSON.parse(jsonStr);
    } catch {
      throw new Error("AI returned non-JSON. Please retry.");
    }

    // Persist
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("marketing_plans").insert({
        profile_links: data.profileLinks as never,
        goals: data.goals,
        plan: plan as never,
      });
    } catch {
      // non-fatal
    }

    return { plan: JSON.parse(JSON.stringify(plan)) as MarketingPlan };
  });

export type MarketingPlan = {
  summary?: string;
  profile_audit?: Array<{
    platform?: string;
    url?: string;
    score?: number;
    strengths?: string[];
    weaknesses?: string[];
    fix_now?: string[];
  }>;
  daily_actions?: Array<{
    day?: string;
    focus?: string;
    tasks?: Array<{ time?: string; task?: string; why?: string }>;
  }>;
  post_drafts?: Array<{
    platform?: string;
    hook?: string;
    body?: string;
    cta?: string;
    hashtags?: string[];
    image_prompt?: string;
  }>;
  income_forecast?: {
    week_1_low_usd?: number;
    week_1_high_usd?: number;
    month_1_low_usd?: number;
    month_1_high_usd?: number;
    quarter_1_low_usd?: number;
    quarter_1_high_usd?: number;
    assumptions?: string[];
  };
  next_milestones?: Array<{ when?: string; milestone?: string; expected_usd?: number }>;
};
