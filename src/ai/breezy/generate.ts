import { ModelError, type JsonModel, type ModelFailure } from "@/ai/shared/gemini";
import { geminiSchemaOf } from "@/ai/shared/jsonSchema";
import { BREEZY_SYSTEM, breezyPrompt } from "./prompt";
import { breezyOutputSchema } from "./schema";
import { validateBreezy, type BreezyCheck, type ValidReply } from "./validate";

/**
 * One Breezy answer (spec 7): a 10 s budget and no retry. Any failure (timeout, Gemini down, an
 * invalid reply, no quota) gives `reply: null`, and the page shows the fixed basics from code.
 */
export const BREEZY_BUDGET_MS = 10_000;
const TEMPERATURE = 0.4;
const MAX_OUTPUT_TOKENS = 1_536;
const SCHEMA = geminiSchemaOf(breezyOutputSchema);

export type BreezyOutcome = "ok" | "invalid" | "quota" | ModelFailure;

export interface BreezyDeps {
  readonly model: JsonModel;
  /** Takes one slot of the Gemini quota; false means the basics. */
  reserve(): Promise<boolean>;
}

export interface BreezyResult {
  readonly reply: ValidReply | null;
  readonly outcome: BreezyOutcome;
}

/** Asks Gemini once and validates the reply; never throws. */
export async function askGemini(check: BreezyCheck, question: string, history: string, deps: BreezyDeps): Promise<BreezyResult> {
  if (!(await deps.reserve())) return { reply: null, outcome: "quota" };
  try {
    const raw = await deps.model.generateJson({
      system: BREEZY_SYSTEM,
      prompt: breezyPrompt(check.input, question, history),
      schema: SCHEMA,
      timeoutMs: BREEZY_BUDGET_MS,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    const reply = validateBreezy(raw, check);
    return reply ? { reply, outcome: "ok" } : { reply: null, outcome: "invalid" };
  } catch (error) {
    return { reply: null, outcome: error instanceof ModelError ? error.kind : "server_error" };
  }
}
