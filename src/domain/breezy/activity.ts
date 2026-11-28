import type { Intensity } from "../rules/activities";
import { isEnclosed, type Mode } from "../rules/modes";

/**
 * Breezy's activity enum (`breezyActivity`), mapped by code to the rule's activity type
 * and a default duration. Gemini only names one of these; anything unknown becomes `other`.
 */
export const BREEZY_ACTIVITIES = ["walk", "temple_errand", "play", "sport", "travel", "other"] as const;
export type BreezyActivity = (typeof BREEZY_ACTIVITIES)[number];

interface ActivitySpec {
  /** Null for travel: enclosed modes are Light, open modes Moderate. */
  readonly intensity: Intensity | null;
  readonly minutes: number;
}

const SPECS: Readonly<Record<BreezyActivity, ActivitySpec>> = {
  walk: { intensity: "moderate", minutes: 45 },
  temple_errand: { intensity: "light", minutes: 30 },
  play: { intensity: "moderate", minutes: 60 },
  sport: { intensity: "hard", minutes: 60 },
  travel: { intensity: null, minutes: 30 },
  other: { intensity: "moderate", minutes: 30 },
};

/** The activity a value names, or `other` for anything unknown. */
export function breezyActivityOf(value: unknown): BreezyActivity {
  return BREEZY_ACTIVITIES.find((a) => a === value) ?? "other";
}

/** The guardrail activity type: travel follows the person's main mode. */
export function breezyIntensity(activity: BreezyActivity, mode: Mode): Intensity {
  return SPECS[activity].intensity ?? (isEnclosed(mode) ? "light" : "moderate");
}

/** The default duration in minutes. */
export const breezyMinutes = (activity: BreezyActivity): number => SPECS[activity].minutes;

/** Clock hours the activity touches when it starts on the hour (1 for every default duration). */
export const breezySpan = (activity: BreezyActivity): number => Math.max(1, Math.ceil(breezyMinutes(activity) / 60));
