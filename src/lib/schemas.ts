// Shared Zod schemas — safe for client and server import.
import { z } from "zod";

export const UrgencySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type Urgency = z.infer<typeof UrgencySchema>;

export const LeadPayloadSchema = z.object({
  source: z.string().trim().min(1).max(64).default("webhook"),
  title: z.string().trim().min(1).max(500),
  budget: z.union([z.number(), z.string()]).optional(),
  urgency: UrgencySchema.default("Medium"),
  description: z.string().trim().max(8000).optional(),
  contact: z.string().trim().max(500).optional(),
});
export type LeadPayload = z.infer<typeof LeadPayloadSchema>;

export const UserEventSchema = z.object({
  event: z.string().trim().min(1).max(128),
  // Do not accept arbitrary emails — anti-open-relay.
  // Callers should identify the user via their session; if the app needs a
  // reference id, it must be an opaque uuid we issued, not a user email.
  ref: z.string().trim().max(128).optional(),
});
export type UserEvent = z.infer<typeof UserEventSchema>;
