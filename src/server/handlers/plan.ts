import { z } from "zod";
import { PLAN_BUDGET_MS } from "@/ai/plan/generate";
import type { PlanCheck } from "@/ai/plan/validate";
import type { JsonModel } from "@/ai/shared/gemini";
import type { FamilyDay } from "@/domain/family/familyDay";
import { planFamilyToday } from "../app/familyPlan";
import { authorize } from "../auth/guard";
import type { Db } from "../db/types";
import type { AppDeps } from "../deps";
import { forbidden, privateJson, readJson } from "../http";
import { familyToday, loadFamily } from "../repos/family";
import { claimPlan, releaseClaim } from "../repos/plans";
import { readUser } from "../repos/users";
import { planCheckFor } from "../plan/context";
import { PLAN_FROM_HOUR } from "../plan/hours";
import { runGeneration } from "../plan/run";

/**
 * `POST /api/plan`: the client asks for today's Gemini wording after Today has already
 * rendered the answer from code. Generation happens in the route under a 40 s lock, within 25 s of
 * the request's start (`maxDuration` leaves room for the save); the answer says what the client
 * shows next: "ready" (refresh to see the words), "busy" (another member is generating; ask again
 * after `retryAfterMs`), or "template" / "capped" (Simple plan).
 */
const body = z.strictObject({ retry: z.boolean().optional() });

type PlanState = "ready" | "busy" | "template" | "capped";
const answer = (state: PlanState, extra: Record<string, string | number> = {}) => privateJson({ state, ...extra });

export async function requestPlan(request: Request, deps: AppDeps): Promise<Response> {
  const started = deps.now().getTime();
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, body);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const user = await readUser(auth.db, uid);
  const bundle = user?.familyId ? await loadFamily(auth.db, user.familyId) : null;
  if (!bundle?.family.memberUids.includes(uid)) return forbidden("You're no longer in this family.");
  if (!deps.gemini) return answer("template", { reason: "not_configured" });
  const planned = await planFamilyToday(bundle, uid, deps.air);
  const check = planCheckFor(bundle, planned);
  if (!planned.day || !check) return answer("template", { reason: "no_air" });
  if (planned.day.summary.hour < PLAN_FROM_HOUR) return answer("template", { reason: "too_early" });
  const date = familyToday(deps.now());
  const claim = await claimPlan(auth.db, bundle.id, date, deps.now(), input.data.retry ?? false);
  if (claim.kind === "fresh") return answer("ready");
  if (claim.kind === "busy") return answer("busy", { retryAfterMs: claim.retryAfterMs });
  if (claim.kind === "capped") return answer("capped");
  const job = { db: auth.db, model: deps.gemini, fid: bundle.id, date, since: claim.since, day: planned.day, check, started };
  return answer((await generateClaimed(job, deps)) === "gemini" ? "ready" : "template");
}

interface ClaimedJob {
  readonly db: Db;
  readonly model: JsonModel;
  readonly fid: string;
  readonly date: string;
  readonly since: string;
  readonly day: FamilyDay;
  readonly check: PlanCheck;
  /** When the request started (ms): the 25 s budget counts from here. */
  readonly started: number;
}

/** Runs a claimed generation; if saving fails, the lock and the day's count are given back. */
async function generateClaimed(job: ClaimedJob, deps: AppDeps): Promise<"gemini" | "template"> {
  const budgetMs = PLAN_BUDGET_MS - (deps.now().getTime() - job.started);
  try {
    return await runGeneration(
      { db: job.db, model: job.model, now: deps.now, log: deps.log },
      job.fid,
      job.date,
      job.day,
      job.check,
      budgetMs,
    );
  } catch (error) {
    await releaseClaim(job.db, job.fid, job.date, job.since);
    throw error;
  }
}
