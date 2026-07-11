// Structured, secret-scrubbing logger for server code.
// Never call from client bundles.

const SENSITIVE_KEYS = /^(authorization|apikey|api_key|token|password|secret|cookie|set-cookie)$/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth-limited]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 500) return value.slice(0, 500) + "…";
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? "[redacted]" : scrub(v, depth + 1);
  }
  return out;
}

export function logError(scope: string, err: unknown, meta?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[${scope}]`, message, scrub(meta) ?? "", stack ? `\n${stack}` : "");
}

export function logInfo(scope: string, message: string, meta?: Record<string, unknown>): void {
  console.log(`[${scope}] ${message}`, meta ? scrub(meta) : "");
}
