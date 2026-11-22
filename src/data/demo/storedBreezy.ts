import { z } from "zod";
import { breezyCard } from "@/domain/breezy/answer";
import { LANGS } from "@/domain/time/format";
import stored from "./storedBreezy.json";

/**
 * The demo's stored Breezy chip answers (spec 7.7.2, 7.8: 0 live calls on page view), written once
 * by `npm run demo:record-breezy` with a real key through the same prompt, validator and rules
 * re-check as a family's question. Keyed "scenario:chip:lang". Empty until a key exists: the demo
 * then shows the code's answer, labelled "Simple answer".
 */
const entry = z.object({
  recordedOn: z.string(),
  model: z.string(),
  promptVersion: z.number(),
  lang: z.enum(LANGS),
  text: z.string().min(1).max(400),
  cards: z.array(breezyCard).max(3),
});
export type StoredBreezy = z.infer<typeof entry>;

const file = z.record(z.string(), entry).parse(stored);

export const storedBreezyKey = (scenario: string, chip: string, lang: string): string => `${scenario}:${chip}:${lang}`;

/** A stored answer, or null when none was recorded. */
export const storedBreezyFor = (key: string): StoredBreezy | null => file[key] ?? null;

/** Every stored answer (for the tests that re-check them). */
export const storedBreezyAnswers = (): [string, StoredBreezy][] => Object.entries(file);
