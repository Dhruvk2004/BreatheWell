import type { z } from "zod";

/** The fetch function, injected so tests replay recorded fixtures (spec 11.4). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Why a data call failed; the UI shows "We can't get the air data right now. We won't guess." */
export type DataErrorCode = "timeout" | "network" | "http" | "invalid";

export type DataResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DataErrorCode };

/** Spec 5.11: Open-Meteo calls time out after 5 s. */
export const DEFAULT_TIMEOUT_MS = 5_000;

export interface FetchOptions {
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
  /** Next.js fetch cache (e.g. `{ revalidate: 3600 }`); ignored by test doubles. */
  readonly next?: { readonly revalidate: number };
}

const failure = (error: DataErrorCode): DataResult<never> => ({ ok: false, error });

/**
 * GETs JSON and parses it with a Zod schema: a response in the wrong shape is "invalid", never
 * passed on. Timeouts and network errors are told apart for the logs (outcome codes only).
 */
export async function fetchJson<T>(url: string, schema: z.ZodType<T>, options: FetchOptions = {}): Promise<DataResult<T>> {
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    const init: RequestInit & { next?: { revalidate: number } } = { signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) };
    if (options.next) init.next = options.next;
    response = await doFetch(url, init);
  } catch (error) {
    return failure(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network");
  }
  if (!response.ok) return failure("http");
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, value: parsed.data } : failure("invalid");
}

/** Builds a query string from defined values. */
export function query(params: Readonly<Record<string, string | number | undefined>>): string {
  const entries = Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined);
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}
