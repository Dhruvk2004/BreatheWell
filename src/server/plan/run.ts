import { generatePlan, type Generated } from "@/ai/plan/generate";
import type { PlanCheck } from "@/ai/plan/validate";
import type { JsonModel } from "@/ai/shared/gemini";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { PersonPlan } from "@/domain/family/people";
import type { Db } from "../db/types";
import { savePlan, type PlanResult } from "../repos/plans";
import { reserveGeminiCall } from "../repos/quota";
import { sectionsOf } from "./sections";

/** What the route needs to run one generation. */
export interface RunDeps {
  readonly db: Db;
  readonly model: JsonModel;
  now(): Date;
  log(event: string, fields?: Record<string, string | number | boolean>): void;
}

/**
 * Runs one claimed generation and saves it (spec 7.2): Gemini's checked words, or a Simple plan
 * when the reply was invalid twice, timed out or the budget said no. Logs outcome codes and
 * latency only, never a prompt, a reply or a name (spec 7.1 item 5).
 */
export async function runGeneration(
  deps: RunDeps,
  fid: string,
  date: string,
  day: FamilyDay,
  check: PlanCheck,
  budgetMs?: number,
): Promise<"gemini" | "template"> {
  const generated = await generatePlan(
    check,
    { model: deps.model, now: () => deps.now().getTime(), reserve: () => reserveGeminiCall(deps.db, "plan", deps.now()) },
    budgetMs,
  );
  const { plan } = generated;
  const result = planResult(generated, check, day.rows, deps.now());
  await savePlan(deps.db, fid, date, result);
  deps.log("plan_generated", {
    outcome: generated.outcome,
    attempts: generated.attempts,
    latencyMs: generated.latencyMs,
    passed: plan?.passed ?? 0,
    failed: plan?.failed ?? 0,
    model: deps.model.name,
  });
  return result.source;
}

/** What a generation stores: Gemini's checked words with their tokens, or an empty Simple plan. */
export function planResult(generated: Generated, check: PlanCheck, rows: readonly PersonPlan[], now: Date): PlanResult {
  const { plan } = generated;
  return {
    source: plan ? "gemini" : "template",
    outcome: generated.outcome,
    now,
    doc: {
      languages: [...check.request.input.languages],
      tokens: plan ? check.request.tokens.people : {},
      home: plan ? [...plan.home] : [],
      together: plan?.together ?? null,
    },
    sections: plan ? sectionsOf(plan, rows) : {},
  };
}
