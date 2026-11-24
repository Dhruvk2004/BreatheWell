import { createHash, timingSafeEqual } from "node:crypto";
import { sweepExpired, type ExpiredSweeper, type SweepBudget } from "../cleanup/sweep";
import { errorResponse, json, NO_STORE } from "../http";

export interface CleanupDeps {
  /** `CRON_SECRET`; Vercel Cron sends it as `Authorization: Bearer …`. Null means the job is off. */
  readonly secret: string | null;
  readonly sweeper: ExpiredSweeper | null;
  readonly clock: () => Date;
  readonly log: (event: string, fields?: Record<string, string | number | boolean>) => void;
  readonly budget?: SweepBudget;
}

const digest = (text: string) => createHash("sha256").update(text).digest();

/** Constant-time comparison of the bearer token with the secret (hashes make the lengths equal). */
export function authorised(header: string | null, secret: string): boolean {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && timingSafeEqual(digest(token), digest(secret));
}

/**
 * `GET /api/cron/cleanup`: Vercel Cron calls it once a day. It fails closed: with no
 * `CRON_SECRET` set nobody can run it, and a wrong or missing token gets 401 before any read.
 */
export async function cleanupGet(request: Request, deps: CleanupDeps): Promise<Response> {
  if (!deps.secret) return errorResponse(503, "not_configured", "The clean-up job is not set up.", NO_STORE);
  if (!authorised(request.headers.get("authorization"), deps.secret)) {
    return errorResponse(401, "unauthorised", "Not allowed.", NO_STORE);
  }
  if (!deps.sweeper) return errorResponse(503, "not_configured", "The database is not set up.", NO_STORE);
  const result = await sweepExpired(deps.sweeper, deps.clock, deps.budget);
  deps.log("cleanup_swept", { total: result.total, complete: result.complete, ...result.deleted });
  return json(result, 200, NO_STORE);
}
