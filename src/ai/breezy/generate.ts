import { ModelError, type JsonModel, type ModelFailure } from "@/ai/shared/gemini";
import { geminiSchemaOf } from "@/ai/shared/jsonSchema";
import { BREEZY_SYSTEM, breezyPrompt } from "./prompt";
import { breezyOutputSchema } from "./schema";
import { validateBreezy, type BreezyCheck, type ValidReply } from "./validate";

/**
 * One Breezy answer within a 10 s budget. Any failure (timeout, Gemini down, an invalid reply, no
 * quota) gives `reply: null`, and the page shows the fixed basics from code. A busy model that
 * refuses quickly (503) is asked once more if at least 4 s of the budget are left.
 */
export const BREEZY_BUDGET_MS = 10_000;
export const RETRY_MIN_LEFT_MS = 4_000;
const TEMPERATURE = 0.4;
const MAX_OUTPUT_TOKENS = 1_536;
const SCHEMA = geminiSchemaOf(breezyOutputSchema);

export type BreezyOutcome = "ok" | "invalid" | "quota" | ModelFailure;

export interface BreezyDeps {
  readonly model: JsonModel;
  /** Takes one slot of the Gemini quota; false means the basics. */
  reserve(): Promise<boolean>;
  /** Milliseconds, for the retry decision; without it there is no retry. */
  readonly now?: () => number;
}

export interface BreezyResult {
  readonly reply: ValidReply | null;
  readonly outcome: BreezyOutcome;
}

async function once(check: BreezyCheck, question: string, history: string, deps: BreezyDeps, timeoutMs: number): Promise<BreezyResult> {
  if (!(await deps.reserve())) return { reply: null, outcome: "quota" };
  try {
    const raw = await deps.model.generateJson({
      system: BREEZY_SYSTEM,
      prompt: breezyPrompt(check.input, question, history),
      schema: SCHEMA,
      timeoutMs,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    const reply = validateBreezy(raw, check);
    return reply ? { reply, outcome: "ok" } : { reply: null, outcome: "invalid" };
  } catch (error) {
    return { reply: null, outcome: error instanceof ModelError ? error.kind : "server_error" };
  }
}

/** Asks Gemini (and once more after a quick refusal) and validates the reply; never throws. */
export async function askGemini(check: BreezyCheck, question: string, history: string, deps: BreezyDeps): Promise<BreezyResult> {
  const started = deps.now?.();
  const first = await once(check, question, history, deps, BREEZY_BUDGET_MS);
  if (first.outcome !== "server_error" || started === undefined || !deps.now) return first;
  const left = BREEZY_BUDGET_MS - (deps.now() - started);
  return left >= RETRY_MIN_LEFT_MS ? once(check, question, history, deps, left) : first;
}
