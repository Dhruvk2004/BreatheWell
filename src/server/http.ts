import type { z } from "zod";
import { InvalidPathId } from "./repos/paths";

/**
 * Response and request helpers for route handlers. Handlers stay free of Next.js imports so they
 * are tested with plain `Request` objects.
 */
export interface ApiError {
  readonly error: { readonly code: string; readonly message: string; readonly fields?: Record<string, string> };
}

/** Signed-in and per-user responses are never cached (spec 11.2). */
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** JSON with explicit cache headers. */
export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers });
}

/** Per-user JSON: never cached; several Set-Cookie headers allowed. */
export function privateJson(data: unknown, status = 200, cookies: readonly string[] = []): Response {
  const headers = new Headers(NO_STORE);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return Response.json(data, { status, headers });
}

/** An error body with a code the client can branch on and a plain-English message. */
export function errorResponse(status: number, code: string, message: string, headers: HeadersInit = {}, extra: object = {}): Response {
  const body = { error: { code, message, ...extra } };
  return json(body, status, { "Cache-Control": "no-store", ...headers });
}

/** 429 with Retry-After. */
export const rateLimited = (retryAfterSeconds: number): Response =>
  errorResponse(429, "rate_limited", "Too many requests. Try again in a few minutes.", { "Retry-After": String(retryAfterSeconds) });

export const forbidden = (message = "You can't do that in this family."): Response => errorResponse(403, "forbidden", message);
export const notFoundError = (): Response => errorResponse(404, "not_found", "We couldn't find that.");

export const MAX_BODY_BYTES = 10_000;

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Issues keyed by their dotted path ("activities.0.band"), first message wins. */
export function fieldErrors(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.length > 0 ? issue.path.map(String).join(".") : "form"] ??= issue.message;
  return fields;
}

/**
 * The body as text, or null once it passes `MAX_BODY_BYTES`: a larger Content-Length is refused
 * before reading, and a stream is cancelled as soon as the running total passes the limit, so a
 * 100 MB upload is never buffered (stage 7 WEB-7, PT-5).
 */
async function readLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    size += next.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(next.value);
  }
  const all = new Uint8Array(size);
  chunks.reduce((at, chunk) => (all.set(chunk, at), at + chunk.byteLength), 0);
  return new TextDecoder().decode(all);
}

/**
 * Reads a JSON body: the whole MIME type must be `application/json` (a cross-site form cannot send
 * it without a preflight), then the size limit, valid JSON and the schema.
 */
export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<Parsed<z.output<S>>> {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json")
    return { ok: false, response: errorResponse(415, "unsupported_media_type", "Send the request as JSON.") };
  const body = await readLimited(request);
  if (body === null) return { ok: false, response: errorResponse(413, "too_large", "The request is too large.") };
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return { ok: false, response: errorResponse(400, "invalid_json", "The request body is not valid JSON.") };
  }
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fields = fieldErrors(parsed.error.issues);
  return { ok: false, response: errorResponse(400, "invalid_input", "Some details need fixing.", {}, { fields }) };
}

/**
 * CSRF check for every mutation (as in Utsav): the browser's `Origin` must be the app's public
 * origin. Without APP_ORIGIN configured, the request's own origin is the reference.
 */
export function isSameOrigin(request: Request, appOrigin: string | null): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === (appOrigin ?? new URL(request.url).origin);
}

export const forbiddenOrigin = (): Response => errorResponse(403, "bad_origin", "This request came from another site.");

/** True for Firestore's "resource exhausted" (the free daily write quota is used up). */
export function isQuotaExhausted(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return e?.code === 8 || e?.code === "resource-exhausted" || (typeof e?.message === "string" && e.message.includes("RESOURCE_EXHAUSTED"));
}

/**
 * Wraps a write route (design "Saving paused"): when Firestore's daily quota is used up the answer
 * is 503 `saving_paused`, so the page says "Saving is paused until tomorrow"; anything else is rethrown.
 */
export async function pausedOnQuota(work: Promise<Response>): Promise<Response> {
  try {
    return await work;
  } catch (error) {
    // An id that is not one path segment ("..%2F..%2Fx") names nothing (stage 7 PT-8).
    if (error instanceof InvalidPathId) return notFoundError();
    if (!isQuotaExhausted(error)) throw error;
    return errorResponse(503, "saving_paused", "Saving is paused until tomorrow.", { "Retry-After": "3600" });
  }
}
