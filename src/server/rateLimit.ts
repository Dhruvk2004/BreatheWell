import { createHash } from "node:crypto";

/**
 * Fixed-window rate limiter kept in memory: public per-IP limits never write to
 * Firestore, so a crawler cannot spend the Spark write quota. Per instance, so best effort.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    /** Requests per window for one key. */
    readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: () => number = Date.now,
  ) {}

  /** Counts one request for the key; `allowed` is false once the window's limit (default: the limiter's) is used. */
  check(key: string, limit = this.limit): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.clock();
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.prune(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= limit) return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(now: number): void {
    if (this.windows.size < 5000) return;
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
}

/** Which client-address headers this deployment may believe. */
export interface ProxyTrust {
  /** On Vercel: the platform sets `x-vercel-forwarded-for` / `x-real-ip` and overwrites X-Forwarded-For. */
  readonly vercel: boolean;
  /** Behind a proxy the owner configured (`TRUST_PROXY=1`) that appends the client to X-Forwarded-For. */
  readonly trustedProxy: boolean;
}

export const proxyTrust = (env: Readonly<Record<string, string | undefined>> = process.env): ProxyTrust => ({
  vercel: env.VERCEL === "1",
  trustedProxy: env.TRUST_PROXY === "1",
});

const firstHop = (value: string | null): string | null => value?.split(",")[0]?.trim() || null;
const lastHop = (value: string | null): string | null =>
  (value ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean)
    .at(-1) ?? null;

/** The client address the platform vouches for; null on a host that sets none we can trust. */
function clientIp(headers: Headers, trust: ProxyTrust): string | null {
  if (trust.vercel)
    return firstHop(headers.get("x-vercel-forwarded-for")) ?? firstHop(headers.get("x-real-ip")) ?? lastHop(headers.get("x-forwarded-for"));
  if (trust.trustedProxy) return lastHop(headers.get("x-forwarded-for")) ?? firstHop(headers.get("x-real-ip"));
  return null;
}

/** An IPv6 address's /64 prefix (one household's whole range is one client); IPv4 as it is. */
export function addressKey(ip: string): string {
  const bare = ip
    .replace(/^\[|\](:\d+)?$/gu, "")
    .replace(/%.*$/u, "")
    .toLowerCase();
  if (!bare.includes(":") || bare.includes(".")) return bare.includes(":") ? (bare.split(":").at(-1) ?? bare) : bare;
  const [head, tail = ""] = bare.split("::");
  const left = head ? head.split(":") : [];
  const right = bare.includes("::") && tail ? tail.split(":") : [];
  const groups = bare.includes("::") ? [...left, ...Array.from({ length: 8 - left.length - right.length }, () => "0"), ...right] : left;
  return groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/u, ""))
    .join(":");
}

/**
 * The client key for per-IP limits: the address the platform vouches for (Vercel's own header, or
 * the rightmost X-Forwarded-For hop behind a trusted proxy), an IPv6 address by its /64, hashed so no
 * IP address is kept even in memory. Null when no trusted address exists: a client-set
 * X-Forwarded-For on a plain `next start` never picks its own bucket.
 */
export function clientKey(headers: Headers, trust: ProxyTrust = proxyTrust()): string | null {
  const ip = clientIp(headers, trust);
  return ip ? createHash("sha256").update(addressKey(ip)).digest("base64url").slice(0, 22) : null;
}

/** Requests without an address share one bucket, so it gets this many times the per-IP limit. */
export const ANONYMOUS_FACTOR = 20;
const ANONYMOUS = "anonymous";
let warned = false;

/**
 * Applies the per-IP limit to a request. The limit relies on the host's forwarded-for header (Vercel
 * always sets it); without one every visitor would share a key, so they share a larger bucket
 * instead of locking each other out after 60 checks, and the server logs it once.
 */
export function checkClient(
  limiter: RateLimiter,
  headers: Headers,
  trust: ProxyTrust = proxyTrust(),
): { allowed: boolean; retryAfterSeconds: number } {
  const key = clientKey(headers, trust);
  if (key) return limiter.check(key);
  if (!warned) {
    warned = true;
    console.warn("Rate limit: no trusted client address (not on Vercel, TRUST_PROXY unset); anonymous requests share one larger bucket.");
  }
  return limiter.check(ANONYMOUS, limiter.limit * ANONYMOUS_FACTOR);
}
