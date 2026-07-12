import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { safeEqual, requireSharedSecret, readBoundedText, CORS_HEADERS, preflight } from "./http.server";

describe("safeEqual", () => {
  it("returns true for equal strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });
  it("returns false for different strings", () => {
    expect(safeEqual("abc", "xyz")).toBe(false);
  });
  it("returns false for different-length strings", () => {
    expect(safeEqual("a", "aa")).toBe(false);
  });
});

describe("requireSharedSecret", () => {
  const ENV = "TEST_SHARED_SECRET_XYZ";
  beforeEach(() => { process.env[ENV] = "s3cret"; });
  afterEach(() => { delete process.env[ENV]; });

  it("returns 401 when header is missing", async () => {
    const req = new Request("http://x", { method: "POST" });
    const res = requireSharedSecret(req, ENV);
    expect(res?.status).toBe(401);
  });

  it("returns 401 when header is wrong", async () => {
    const req = new Request("http://x", { method: "POST", headers: { "x-webhook-secret": "wrong" } });
    expect(requireSharedSecret(req, ENV)?.status).toBe(401);
  });

  it("passes when header matches", () => {
    const req = new Request("http://x", { method: "POST", headers: { "x-webhook-secret": "s3cret" } });
    expect(requireSharedSecret(req, ENV)).toBeNull();
  });

  it("skips silently when env var unset (dev fallback)", () => {
    delete process.env[ENV];
    const req = new Request("http://x", { method: "POST" });
    expect(requireSharedSecret(req, ENV)).toBeNull();
  });
});

describe("readBoundedText", () => {
  it("returns null when content-length exceeds limit", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "content-length": "999999" },
      body: "x",
    });
    expect(await readBoundedText(req, 10)).toBeNull();
  });

  it("returns text under the limit", async () => {
    const req = new Request("http://x", { method: "POST", body: "hello" });
    expect(await readBoundedText(req, 1024)).toBe("hello");
  });
});

describe("preflight & CORS", () => {
  it("preflight has 204 and CORS headers", () => {
    const res = preflight();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(CORS_HEADERS["Access-Control-Allow-Origin"]);
  });
});
