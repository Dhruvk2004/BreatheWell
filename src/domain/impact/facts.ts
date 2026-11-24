import { HOME_FACTS } from "./facts/home";
import { PROTECT_FACTS } from "./facts/protect";
import { TRAVEL_FACTS } from "./facts/travel";
import type { Fact } from "./facts/types";
import { WEATHER_FACTS } from "./facts/weather";

export type { Bilingual, Fact, Source } from "./facts/types";

/** The facts library, version 1: every fact with EN + HI text, level 3 and a source. */
export const FACTS: readonly Fact[] = [...WEATHER_FACTS, ...PROTECT_FACTS, ...HOME_FACTS, ...TRAVEL_FACTS];

const BY_ID = new Map(FACTS.map((f) => [f.id, f]));

/** A fact by id, or undefined (Gemini output with an unknown `factId` is rejected by the validator). */
export const factById = (id: string): Fact | undefined => BY_ID.get(id);

/** True for a known fact id. */
export const isFactId = (id: string): boolean => BY_ID.has(id);
