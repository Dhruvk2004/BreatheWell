import type { Lang } from "../time/format";
import type { ProfileInput } from "./profile";

/** Q2 (spec 5.6): Morning 5–7 · Morning 7–10 · Evening 5–8 · No walk. */
export const QUICK_WALKS = ["early", "morning", "evening", "none"] as const;
export type QuickWalk = (typeof QUICK_WALKS)[number];

/** Q3: Walk · Auto or bus · Metro · Car · I mostly stay in. */
export const QUICK_TRAVEL = ["walk", "auto_bus", "metro", "car", "home"] as const;
export type QuickTravel = (typeof QUICK_TRAVEL)[number];

export interface QuickAnswers {
  readonly name: string;
  readonly language: Lang;
  readonly textSize: ProfileInput["textSize"];
  readonly conditions: readonly ProfileInput["conditions"][number][];
  readonly shareWith: ProfileInput["shareWith"];
  readonly walk: QuickWalk;
  readonly travel: QuickTravel;
}

/**
 * The 60+ quick path (spec 5.6): three questions, then defaults: a 45-minute walk that can move to
 * any time today, trips under 15 minutes. The text size is the one on screen (Large is pre-selected
 * for 60+, spec 6.1 item 2). Everything can be changed in Profile.
 */
export function quickProfile(answers: QuickAnswers): ProfileInput {
  const walk =
    answers.walk === "none"
      ? []
      : [
          {
            type: answers.walk === "evening" ? "evening_walk" : "morning_walk",
            band: answers.walk,
            flex: "any",
            duration: "15to60",
          } as const,
        ];
  return {
    name: answers.name,
    language: answers.language,
    textSize: answers.textSize,
    ageGroup: "60plus",
    conditions: [...answers.conditions],
    shareWith: answers.shareWith,
    activities: walk,
    travel: { main: answers.travel, tripLength: "under15", others: [] },
  };
}
