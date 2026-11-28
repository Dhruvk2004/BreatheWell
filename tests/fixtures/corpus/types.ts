import type { RuleFacts } from "@/ai/shared/contradiction";
import type { Rejection } from "@/ai/shared/validate";

/** One validator corpus sentence: good ones must pass; bad ones must fail for these reasons. */
export interface CorpusCase {
  readonly text: string;
  readonly lang: "en" | "hi";
  /** A plan item checked against this rule result, or plain text when absent. */
  readonly rule?: keyof typeof RULES;
  readonly forDependent?: boolean;
  /** [] for a good sentence; the reasons it must be rejected for, otherwise. */
  readonly expect: readonly Rejection[];
}

const base = { usualMinute: 0, bestTime: null, switchTo: null } as const;

/** Rule results from the Smog morning family. */
export const RULES = {
  walkMove: { ...base, verdictAtUsual: "avoid", suggestion: "move_time", usualHour: 6, usualMinute: 30, bestTime: 15 },
  walkIndoor: { ...base, verdictAtUsual: "avoid", suggestion: "indoor", usualHour: 6, usualMinute: 30 },
  schoolSwitch: { ...base, verdictAtUsual: "avoid", suggestion: "switch_mode", usualHour: 7, switchTo: "school_bus" },
  goPlan: { ...base, verdictAtUsual: "go", suggestion: "as_planned", usualHour: 17 },
} as const satisfies Record<string, RuleFacts>;

/** Times the Smog morning input allows: usual times, best times and window ends. */
export const ALLOWED_TIMES = [
  { hour: 6, minute: 30 },
  { hour: 7, minute: 0 },
  { hour: 9, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 15, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 17, minute: 0 },
];

/** Names and aliases the family uses; Gemini never received any of them. */
export const NAMES = ["Ramesh", "Dadaji", "Riya", "Neha", "Papa", "दादाजी", "रिया", "पापा"];
