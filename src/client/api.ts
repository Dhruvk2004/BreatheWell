import type { z } from "zod";
import { announceAccountChange } from "./accountEvents";

/**
 * The browser side of the JSON API: same-origin requests with the session cookie,
 * responses validated with Zod, and errors carried as `ApiRequestError` with the server's code and
 * the whole body (join errors carry the family and admin names).
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body?: unknown;
  /** Aborts the request (Breezy gives up after its client wait). */
  readonly signal?: AbortSignal;
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

function errorOf(status: number, body: unknown): ApiRequestError {
  const all = record(body);
  const error = record(all.error);
  const code = typeof error.code === "string" ? error.code : typeof all.kind === "string" ? all.kind : "http_error";
  const message = typeof error.message === "string" ? error.message : "Something went wrong. Try again.";
  return new ApiRequestError(status, code, message, all);
}

/** Sends a request and returns the validated JSON body. */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options: ApiOptions = {},
  fetcher: Fetch = fetch,
): Promise<z.output<S>> {
  const { method = "GET", body, signal } = options;
  const response = await fetcher(path, {
    method,
    signal,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => undefined);
  // A sign-in, profile save or sign-out may have changed the account cookie.
  if (method !== "GET") announceAccountChange();
  if (!response.ok) throw errorOf(response.status, json);
  return schema.parse(json);
}

/** The server's error code, or "network" when the request never got an answer. */
export const errorCode = (error: unknown): string => (error instanceof ApiRequestError ? error.code : "network");
