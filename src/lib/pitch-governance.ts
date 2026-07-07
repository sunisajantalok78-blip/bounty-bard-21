// Client-side Anti-Spam & Rate-Limiting Governance for AI Pitch Generation.
// - Rolling 24h cap of DAILY_PITCH_LIMIT generations.
// - 10s global cooldown between generations (anti-bulk click).
// State is persisted in localStorage and exposed through useSyncExternalStore.
import { useSyncExternalStore } from "react";

export const DAILY_PITCH_LIMIT = 30;
export const COOLDOWN_MS = 10_000;
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

const STAMPS_KEY = "pitch-governance:stamps";
const COOLDOWN_KEY = "pitch-governance:cooldown-until";

type State = { stamps: number[]; cooldownUntil: number };

const isBrowser = typeof window !== "undefined";

function readStamps(): number[] {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(STAMPS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as number[];
    const cutoff = Date.now() - ROLLING_WINDOW_MS;
    return arr.filter((t) => typeof t === "number" && t > cutoff);
  } catch { return []; }
}
function readCooldown(): number {
  if (!isBrowser) return 0;
  try { return Number(window.localStorage.getItem(COOLDOWN_KEY) ?? 0) || 0; } catch { return 0; }
}
function writeStamps(s: number[]) { if (isBrowser) window.localStorage.setItem(STAMPS_KEY, JSON.stringify(s)); }
function writeCooldown(t: number) { if (isBrowser) window.localStorage.setItem(COOLDOWN_KEY, String(t)); }

let state: State = { stamps: readStamps(), cooldownUntil: readCooldown() };
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

// Tick every 500ms so cooldown countdown updates smoothly and stamps age out.
if (isBrowser) {
  setInterval(() => {
    const cutoff = Date.now() - ROLLING_WINDOW_MS;
    const pruned = state.stamps.filter((t) => t > cutoff);
    const changed = pruned.length !== state.stamps.length || state.cooldownUntil !== readCooldown();
    if (changed || state.cooldownUntil > 0) {
      if (pruned.length !== state.stamps.length) writeStamps(pruned);
      state = { stamps: pruned, cooldownUntil: readCooldown() };
      emit();
    }
  }, 500);
  window.addEventListener("storage", (e) => {
    if (e.key === STAMPS_KEY || e.key === COOLDOWN_KEY) {
      state = { stamps: readStamps(), cooldownUntil: readCooldown() };
      emit();
    }
  });
}

export type GovernanceSnapshot = {
  used: number;
  limit: number;
  remaining: number;
  capReached: boolean;
  cooldownRemainingMs: number;
  cooldownActive: boolean;
  canGenerate: boolean;
  blockReason: null | "cap" | "cooldown";
};

function snapshot(): GovernanceSnapshot {
  const now = Date.now();
  const cutoff = now - ROLLING_WINDOW_MS;
  const used = state.stamps.filter((t) => t > cutoff).length;
  const cooldownRemainingMs = Math.max(0, state.cooldownUntil - now);
  const capReached = used >= DAILY_PITCH_LIMIT;
  const cooldownActive = cooldownRemainingMs > 0;
  return {
    used,
    limit: DAILY_PITCH_LIMIT,
    remaining: Math.max(0, DAILY_PITCH_LIMIT - used),
    capReached,
    cooldownRemainingMs,
    cooldownActive,
    canGenerate: !capReached && !cooldownActive,
    blockReason: capReached ? "cap" : cooldownActive ? "cooldown" : null,
  };
}

// Memoize snapshot so useSyncExternalStore gets stable identity between ticks
// that don't actually change any observable field.
let cached: GovernanceSnapshot = snapshot();
function getSnapshotStable(): GovernanceSnapshot {
  const next = snapshot();
  if (
    next.used === cached.used &&
    next.capReached === cached.capReached &&
    next.cooldownActive === cached.cooldownActive &&
    Math.floor(next.cooldownRemainingMs / 500) === Math.floor(cached.cooldownRemainingMs / 500)
  ) return cached;
  cached = next;
  return next;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function usePitchGovernance(): GovernanceSnapshot {
  return useSyncExternalStore(subscribe, getSnapshotStable, () => cached);
}

/** Call BEFORE dispatching a generation. Returns true if allowed (and records it). */
export function requestGeneration(): { ok: boolean; reason: "cap" | "cooldown" | null } {
  const s = snapshot();
  if (s.capReached) return { ok: false, reason: "cap" };
  if (s.cooldownActive) return { ok: false, reason: "cooldown" };
  const now = Date.now();
  const stamps = [...state.stamps, now];
  const cooldownUntil = now + COOLDOWN_MS;
  writeStamps(stamps);
  writeCooldown(cooldownUntil);
  state = { stamps, cooldownUntil };
  cached = snapshot();
  emit();
  return { ok: true, reason: null };
}

/** Roll back a recorded generation when the server aborts (e.g. idempotency skip). */
export function refundGeneration() {
  if (state.stamps.length === 0) return;
  const stamps = state.stamps.slice(0, -1);
  writeStamps(stamps);
  writeCooldown(0);
  state = { stamps, cooldownUntil: 0 };
  cached = snapshot();
  emit();
}
