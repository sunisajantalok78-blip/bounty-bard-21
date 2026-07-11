// Shared HTTP helpers for server routes (webhooks, public APIs).
// Server-only.

import { timingSafeEqual } from "crypto";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-webhook-secret",
} as const;

const JSON_HEADERS = { "content-type": "application/json", ...CORS_HEADERS };

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Compares two strings in constant time. Different-length strings return false. */
export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify shared-secret header. Returns null if authorized, or a 401 Response
 * to return directly if not. Skips silently when the secret env var is unset
 * so local/dev workflows keep working, but logs a warning.
 */
export function requireSharedSecret(
  request: Request,
  envName: string,
  headerName = "x-webhook-secret",
): Response | null {
  const expected = process.env[envName];
  if (!expected) {
    console.warn(`[http] ${envName} not configured — public endpoint is UNAUTHENTICATED`);
    return null;
  }
  const provided = request.headers.get(headerName) ?? "";
  if (!safeEqual(provided, expected)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

/** Read request body as text with a hard size cap. Returns null if oversize. */
export async function readBoundedText(request: Request, maxBytes = 32 * 1024): Promise<string | null> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  return text;
}
