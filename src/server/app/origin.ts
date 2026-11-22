/**
 * The app's absolute origin for links people open somewhere else: the invite QR, Copy link and the
 * WhatsApp texts (spec 5.3, 5.11). A phone camera cannot open a relative path, so without
 * `APP_ORIGIN` the request's own host is used, but only a host the deployment names (a local dev
 * host, or Vercel's own `VERCEL_*_URL` values): a client-chosen `Host` or `X-Forwarded-Host` never
 * reaches a join link (stage 7 WEB-2, PT-9). `X-Forwarded-Host` is read only behind a proxy the
 * owner trusts (`TRUST_PROXY=1`).
 */
const HOST = /^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/i;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const FALLBACK = "localhost:3000";

const first = (value: string | null): string | null => value?.split(",")[0]?.trim() || null;

export interface OriginTrust {
  /** Hosts the deployment answers on, besides local dev hosts. */
  readonly hosts: readonly string[];
  /** Read `X-Forwarded-Host` (only behind a trusted proxy). */
  readonly forwardedHost: boolean;
}

/** The hosts Vercel names for this deployment, and whether a trusted proxy sets X-Forwarded-Host. */
export const envTrust = (env: Readonly<Record<string, string | undefined>> = process.env): OriginTrust => ({
  hosts: [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL, env.VERCEL_URL].filter((h): h is string => Boolean(h)),
  forwardedHost: env.TRUST_PROXY === "1",
});

/** `APP_ORIGIN` when set, else `https://<host>` from the request when the host is trusted (http for a local dev host). */
export function siteOrigin(appOrigin: string | null, headers: Headers, trust: OriginTrust = envTrust()): string {
  if (appOrigin) return appOrigin;
  const raw = (trust.forwardedHost ? first(headers.get("x-forwarded-host")) : null) ?? first(headers.get("host"));
  const known = raw !== null && HOST.test(raw) && (LOCAL.test(raw) || trust.hosts.some((h) => h.toLowerCase() === raw.toLowerCase()));
  const host = known ? raw : FALLBACK;
  const forwarded = first(headers.get("x-forwarded-proto"));
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : LOCAL.test(host) ? "http" : "https";
  return `${proto}://${host}`;
}
