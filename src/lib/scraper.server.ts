// Real scraping + validation engine. Server-only.
// Uses Jina AI search (https://s.jina.ai) — free, no key required (rate-limited).
// MX lookups via Google DNS-over-HTTPS (works in the Cloudflare Worker runtime).

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g;
const HANDLE_RE = /(?:^|[\s(])@([a-zA-Z0-9_.]{2,30})/g;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

export type ExtractedContacts = {
  emails: string[];
  phones: string[];
  handles: string[];
  urls: string[];
};

export function extractContacts(text: string): ExtractedContacts {
  const t = text ?? "";
  const emails = Array.from(new Set(t.match(EMAIL_RE) ?? [])).map((e) => e.toLowerCase());
  const phones = Array.from(
    new Set((t.match(PHONE_RE) ?? []).map((s) => s.trim()).filter((s) => s.replace(/\D/g, "").length >= 7)),
  );
  const handles = Array.from(new Set(Array.from(t.matchAll(HANDLE_RE)).map((m) => `@${m[1]}`)));
  const urls = Array.from(new Set(t.match(URL_RE) ?? []));
  return { emails, phones, handles, urls };
}

// Google DNS-over-HTTPS MX lookup. Returns true if domain has at least one MX record.
export async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { accept: "application/dns-json" },
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { Status?: number; Answer?: Array<{ type: number; data: string }> };
    if (j.Status !== 0 || !Array.isArray(j.Answer)) return false;
    return j.Answer.some((a) => a.type === 15 && typeof a.data === "string" && a.data.length > 0);
  } catch {
    return false;
  }
}

export async function isEmailDeliverable(email: string): Promise<boolean> {
  const m = /^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/.exec(email.trim());
  if (!m) return false;
  const domain = m[2].toLowerCase();
  // Skip obvious disposable/noise
  if (/^(example|test|localhost|invalid)\./.test(domain)) return false;
  return hasMxRecord(domain);
}

export type JinaHit = { title: string; url: string; description?: string; content?: string };

export async function jinaSearch(query: string, limit = 5): Promise<JinaHit[]> {
  const key = process.env.JINA_API_KEY;
  const headers: Record<string, string> = { accept: "application/json" };
  if (key) headers["authorization"] = `Bearer ${key}`;
  try {
    const res = await fetch(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, { headers });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: JinaHit[] };
    const hits = Array.isArray(j.data) ? j.data : [];
    return hits.slice(0, limit).map((h) => ({
      title: (h.title ?? "").toString().slice(0, 400),
      url: (h.url ?? "").toString(),
      description: (h.description ?? "").toString(),
      content: (h.content ?? "").toString(),
    }));
  } catch {
    return [];
  }
}

export type ValidationResult = {
  contact: string | null;
  validation_status: "verified" | "invalid";
  raw_social_data: {
    emails: string[];
    phones: string[];
    handles: string[];
    urls: string[];
    email_deliverable?: boolean;
  };
};

export async function validateFromText(text: string, fallbackUrl?: string | null): Promise<ValidationResult> {
  const c = extractContacts(text);
  if (fallbackUrl && !c.urls.includes(fallbackUrl)) c.urls.unshift(fallbackUrl);

  let emailDeliverable: boolean | undefined;
  if (c.emails[0]) emailDeliverable = await isEmailDeliverable(c.emails[0]);

  const primary =
    (emailDeliverable ? c.emails[0] : undefined) ??
    c.phones[0] ??
    c.urls[0] ??
    c.handles[0] ??
    null;

  const verified = Boolean(primary) && (text ?? "").length >= 30;

  return {
    contact: primary,
    validation_status: verified ? "verified" : "invalid",
    raw_social_data: {
      emails: c.emails,
      phones: c.phones,
      handles: c.handles,
      urls: c.urls,
      email_deliverable: emailDeliverable,
    },
  };
}

// ---------- Portfolio-driven query builder ----------
// Turns each my_portfolio row into a set of targeted client-intent search queries.
export type PortfolioItem = { category: string; content: string };

const INTENT_TEMPLATES = [
  (kw: string) => `need ${kw} freelancer`,
  (kw: string) => `hiring ${kw} specialist`,
  (kw: string) => `looking for ${kw} expert`,
  (kw: string) => `${kw} consultant wanted`,
];

const STOPWORDS = new Set([
  "the","and","for","with","from","that","this","have","has","will","are","was","were","our","your","you","their","them","they","its","into","about","over","under","using","use","used","can","also","been","being","not","but","all","any","who","what","when","where","how","why","which","some","more","most","such","than","then","just","like","one","two","three","new","across","per","via","etc","inc","ltd","co",
]);

function extractKeywords(text: string, max = 4): string[] {
  const cleaned = (text ?? "").toLowerCase().replace(/[^a-z0-9\s+#./-]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  // Prefer multi-word noun-ish phrases: take bigrams of non-stopword tokens
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i], b = tokens[i + 1];
    if (a.length < 3 || b.length < 3) continue;
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    bigrams.push(`${a} ${b}`);
  }
  const unigrams = tokens.filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  const scored = new Map<string, number>();
  for (const p of bigrams) scored.set(p, (scored.get(p) ?? 0) + 3);
  for (const u of unigrams) scored.set(u, (scored.get(u) ?? 0) + 1);
  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

export function buildPortfolioQueries(items: PortfolioItem[], perItem = 3): string[] {
  const out = new Set<string>();
  for (const it of items) {
    const cat = (it.category ?? "").trim().toLowerCase();
    const kws = extractKeywords(`${it.category} ${it.content}`, 4);
    // Category itself is a strong seed
    if (cat) {
      for (const tpl of INTENT_TEMPLATES.slice(0, perItem)) out.add(tpl(cat));
    }
    for (const kw of kws.slice(0, perItem)) {
      out.add(INTENT_TEMPLATES[0](kw));
      out.add(INTENT_TEMPLATES[2](kw));
    }
  }
  return Array.from(out);
}

