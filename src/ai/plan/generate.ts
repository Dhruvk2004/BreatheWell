import { geminiSchemaOf } from "@/ai/shared/jsonSchema";
import { ModelError, type JsonModel, type ModelFailure } from "@/ai/shared/gemini";
import { planPrompt, PLAN_SYSTEM } from "./prompt";
import { planOutputSchema } from "./schema";
import { validatePlan, type PlanCheck, type ValidPlan } from "./validate";

/**
 * One family plan generation: a 25 s budget, one Gemini call, and one retry only when
 * at least 10 s are left and the failure was not a 4xx. An invalid reply twice, a timeout or no
 * budget gives `plan: null`, which means the template plan. Every call first asks `reserve` for a
 * slot in the global quota; a refused slot also means the template.
 */
export const PLAN_BUDGET_MS = 25_000;
export const RETRY_MIN_MS = 10_000;
/** Below this, a first call could not finish: the template is used without calling Gemini. */
export const FIRST_CALL_MIN_MS = 5_000;
const TEMPERATURE = 0.4;
const MAX_OUTPUT_TOKENS = 4_096;

export type PlanOutcome = "ok" | "invalid" | "quota" | ModelFailure;

export interface GenerateDeps {
  readonly model: JsonModel;
  /** Milliseconds, for the budget (injected so tests control time). */
  now(): number;
  /** Takes one slot of the Gemini quota; false means switch to the template. */
  reserve(): Promise<boolean>;
}

export interface Generated {
  readonly plan: ValidPlan | null;
  readonly outcome: PlanOutcome;
  readonly attempts: number;
  readonly latencyMs: number;
}

const SCHEMA = geminiSchemaOf(planOutputSchema);

async function attempt(check: PlanCheck, deps: GenerateDeps, timeoutMs: number): Promise<ValidPlan | PlanOutcome> {
  if (!(await deps.reserve())) return "quota";
  try {
    const raw = await deps.model.generateJson({
      system: PLAN_SYSTEM,
      prompt: planPrompt(check.request.input),
      schema: SCHEMA,
      timeoutMs,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    return validatePlan(raw, check) ?? "invalid";
  } catch (error) {
    return error instanceof ModelError ? error.kind : "server_error";
  }
}

const NOT_RETRIED: ReadonlySet<PlanOutcome> = new Set(["client_error", "rate_limited", "quota"]);

/** True when another attempt fits: time left and a failure worth retrying. */
const canAttempt = (attempts: number, left: number, outcome: PlanOutcome): boolean =>
  attempts === 0 ? left >= FIRST_CALL_MIN_MS : left >= RETRY_MIN_MS && !NOT_RETRIED.has(outcome);

/**
 * Generates and validates the family's plan words; never throws. `budgetMs` is what is left of the
 * request's own 25 s (the route subtracts the time spent before the call), so a slow air fetch
 * never pushes the save past the function's limit.
 */
export async function generatePlan(check: PlanCheck, deps: GenerateDeps, budgetMs = PLAN_BUDGET_MS): Promise<Generated> {
  const start = deps.now();
  let attempts = 0;
  let outcome: PlanOutcome = "timeout";
  while (attempts < 2) {
    const left = budgetMs - (deps.now() - start);
    if (!canAttempt(attempts, left, outcome)) break;
    attempts += 1;
    const result = await attempt(check, deps, left);
    if (typeof result !== "string") return { plan: result, outcome: "ok", attempts, latencyMs: deps.now() - start };
    outcome = result;
  }
  return { plan: null, outcome, attempts, latencyMs: deps.now() - start };
}
