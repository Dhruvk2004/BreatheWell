import { factById } from "./facts";

/** The winter-smog actions Learn leads with; each one is backed by a library fact. */
export const TOP_ACTION_IDS = ["clean", "room", "incense", "metro", "n95"] as const;
export type TopActionId = (typeof TOP_ACTION_IDS)[number];

export interface TopAction {
  readonly id: TopActionId;
  readonly factId: string;
  /**
   * 1 = the biggest change to a family's daily PM2.5 dose, by the share of the day each one touches:
   * outdoor time moved to the clean afternoon hours, then the room people sleep in (a third of the
   * day), indoor sources, the commute, and last the mask, which protects only the hours outside.
   */
  readonly rank: number;
}

const ACTIONS: readonly TopAction[] = [
  { id: "n95", factId: "n95_fit", rank: 5 },
  { id: "metro", factId: "metro_exposure", rank: 4 },
  { id: "incense", factId: "incense_pm", rank: 3 },
  { id: "room", factId: "purifier_room_door", rank: 2 },
  { id: "clean", factId: "afternoon_mixing", rank: 1 },
];

/**
 * The top actions in rank order, keeping only those whose fact is in the library (a removed fact
 * drops its action instead of showing an empty "Why?").
 */
export function topActions(count = 5): readonly TopAction[] {
  return [...ACTIONS]
    .filter((a) => factById(a.factId) !== undefined)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count);
}

/** Learn's worked example: a day-average PM2.5 (µg/m³) typical of a Delhi smog day. */
export const EXAMPLE_DAY_PM25 = 150;
