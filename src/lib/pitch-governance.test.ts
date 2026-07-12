// Node env — jsdom not needed. We stub localStorage on globalThis before import.
import { describe, it, expect, beforeEach, vi } from "vitest";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}

// Set up a minimal window before importing the module.
(globalThis as any).window = {
  localStorage: new MemStorage(),
  addEventListener: () => {},
};

let gov: typeof import("./pitch-governance");

beforeEach(async () => {
  vi.resetModules();
  (globalThis as any).window.localStorage.clear();
  gov = await import("./pitch-governance");
});

describe("pitch governance", () => {
  it("allows a first generation and records a stamp", () => {
    const r = gov.requestGeneration();
    expect(r.ok).toBe(true);
    expect(r.reason).toBeNull();
  });

  it("blocks second call within cooldown", () => {
    expect(gov.requestGeneration().ok).toBe(true);
    const r2 = gov.requestGeneration();
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("cooldown");
  });

  it("refundGeneration clears cooldown and rolls back stamp", () => {
    gov.requestGeneration();
    gov.refundGeneration();
    const r = gov.requestGeneration();
    expect(r.ok).toBe(true);
  });

  it("enforces daily cap regardless of cooldown", () => {
    // Seed localStorage with DAILY_PITCH_LIMIT recent stamps and no cooldown.
    const now = Date.now();
    const stamps = Array.from({ length: gov.DAILY_PITCH_LIMIT }, (_, i) => now - i * 1000);
    (globalThis as any).window.localStorage.setItem("pitch-governance:stamps", JSON.stringify(stamps));
    (globalThis as any).window.localStorage.setItem("pitch-governance:cooldown-until", "0");
    // Re-import so module reads fresh storage.
    return (async () => {
      vi.resetModules();
      const fresh = await import("./pitch-governance");
      const r = fresh.requestGeneration();
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("cap");
    })();
  });
});
