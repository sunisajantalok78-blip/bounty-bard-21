import { describe, it, expect } from "vitest";
import { LeadPayloadSchema, UserEventSchema, UrgencySchema } from "./schemas";

describe("LeadPayloadSchema", () => {
  it("accepts a minimal valid payload and applies defaults", () => {
    const parsed = LeadPayloadSchema.parse({ title: "Need a CRM" });
    expect(parsed.source).toBe("webhook");
    expect(parsed.urgency).toBe("Medium");
    expect(parsed.title).toBe("Need a CRM");
  });

  it("trims whitespace", () => {
    const parsed = LeadPayloadSchema.parse({ title: "   spaced   ", source: "  LinkedIn  " });
    expect(parsed.title).toBe("spaced");
    expect(parsed.source).toBe("LinkedIn");
  });

  it("rejects empty title", () => {
    expect(() => LeadPayloadSchema.parse({ title: "" })).toThrow();
    expect(() => LeadPayloadSchema.parse({ title: "   " })).toThrow();
  });

  it("rejects oversized description", () => {
    expect(() => LeadPayloadSchema.parse({ title: "t", description: "x".repeat(8001) })).toThrow();
  });

  it("rejects invalid urgency", () => {
    expect(() => LeadPayloadSchema.parse({ title: "t", urgency: "urgent" })).toThrow();
  });

  it("allows string or number budget", () => {
    expect(LeadPayloadSchema.parse({ title: "t", budget: 500 }).budget).toBe(500);
    expect(LeadPayloadSchema.parse({ title: "t", budget: "$500" }).budget).toBe("$500");
  });
});

describe("UserEventSchema", () => {
  it("accepts event only", () => {
    expect(UserEventSchema.parse({ event: "profile.viewed" }).event).toBe("profile.viewed");
  });
  it("rejects missing event", () => {
    expect(() => UserEventSchema.parse({})).toThrow();
  });
  it("caps ref length", () => {
    expect(() => UserEventSchema.parse({ event: "e", ref: "x".repeat(129) })).toThrow();
  });
});

describe("UrgencySchema", () => {
  it("matches all four levels", () => {
    for (const u of ["Low", "Medium", "High", "Critical"] as const) {
      expect(UrgencySchema.parse(u)).toBe(u);
    }
  });
});
