import { ModelError, type JsonModel, type ModelFailure } from "@/ai/shared/gemini";
import { geminiSchemaOf } from "@/ai/shared/jsonSchema";
import type { ClockTime } from "@/ai/shared/times";
import { COMMUNITY_SYSTEM, communityPrompt } from "./prompt";
import { communityOutputSchema, type CommunityOutput, type CommunityPromptInput } from "./schema";
import { validateCommunity } from "./validate";

/** One community message generation: a 15 s budget, no retry; any failure means the template. */
export const COMMUNITY_BUDGET_MS = 15_000;
const SCHEMA = geminiSchemaOf(communityOutputSchema);

export type CommunityOutcome = "ok" | "invalid" | "quota" | ModelFailure;

export interface CommunityDeps {
  readonly model: JsonModel;
  reserve(): Promise<boolean>;
}

export async function generateCommunity(
  input: CommunityPromptInput,
  times: readonly ClockTime[],
  deps: CommunityDeps,
): Promise<{ words: CommunityOutput | null; outcome: CommunityOutcome }> {
  if (!(await deps.reserve())) return { words: null, outcome: "quota" };
  try {
    const raw = await deps.model.generateJson({
      system: COMMUNITY_SYSTEM,
      prompt: communityPrompt(input),
      schema: SCHEMA,
      timeoutMs: COMMUNITY_BUDGET_MS,
      temperature: 0.4,
      maxOutputTokens: 1_024,
    });
    const words = validateCommunity(raw, times, input);
    return words ? { words, outcome: "ok" } : { words: null, outcome: "invalid" };
  } catch (error) {
    return { words: null, outcome: error instanceof ModelError ? error.kind : "server_error" };
  }
}
