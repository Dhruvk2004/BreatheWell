import { toggleConditionTicks } from "@/domain/rules/conditionTicks";
import { CHOICE_DEFAULTS, profileInput, type ActivityInput, type AdultChoice, type ProfileInput } from "@/domain/members/profile";
import { quickProfile, type QuickTravel, type QuickWalk } from "@/domain/members/quickPath";
import type { TextSize } from "@/components/prefs/cookies";
import type { Lang } from "@/domain/time/format";

/**
 * Onboarding's answers while they are being given (spec 6.1, 10.5): nothing is lost on Back, and
 * nothing is sent until the summary's Looks good. Pure, so every path is unit-tested.
 */
export interface Draft {
  readonly name: string;
  readonly language: Lang;
  /** The size picked in onboarding; null until picked, then the size on screen is saved. */
  readonly textSize: TextSize | null;
  readonly ageGroup: ProfileInput["ageGroup"] | null;
  readonly conditions: readonly ProfileInput["conditions"][number][];
  readonly shareWith: ProfileInput["shareWith"];
  readonly activities: readonly ActivityInput[];
  readonly stayIn: boolean;
  readonly travel: {
    readonly main: ProfileInput["travel"]["main"] | null;
    readonly tripLength: ProfileInput["travel"]["tripLength"];
    readonly others: readonly ProfileInput["travel"]["others"][number][];
  };
  readonly quickWalk: QuickWalk;
  readonly quickTravel: QuickTravel | null;
}

export type Step =
  "start" | "about" | AboutPart | "age" | "health" | "activities" | "travel" | "summary" | "quickHealth" | "quickWalk" | "quickTravel";

export function initialDraft(saved: ProfileInput | null, googleName: string, lang: Lang): Draft {
  return {
    name: saved?.name ?? googleName,
    language: saved?.language ?? lang,
    textSize: saved?.textSize ?? null,
    ageGroup: saved?.ageGroup ?? null,
    conditions: saved?.conditions ?? [],
    shareWith: saved?.shareWith ?? "self",
    activities: saved?.activities ?? [],
    stayIn: saved ? saved.activities.length === 0 : false,
    travel: { main: saved?.travel.main ?? null, tripLength: saved?.travel.tripLength ?? "15to45", others: saved?.travel.others ?? [] },
    quickWalk: "early",
    quickTravel: null,
  };
}

/** Step 1 split one question per screen in large-text mode (spec 6.1 "one question per screen"). */
export type AboutPart = "aboutLanguage" | "aboutSize" | "aboutName";
export const ABOUT_PARTS: readonly AboutPart[] = ["aboutLanguage", "aboutSize", "aboutName"];

/**
 * The screens in order: the standard five, or the 60+ quick path after the age step (spec 5.6).
 * With `large` text, step 1 is three screens (language, text size, name).
 */
export function stepsFor(draft: Draft, askStart: boolean, large = false): Step[] {
  const about: Step[] = large ? [...ABOUT_PARTS] : ["about"];
  const first: Step[] = [...(askStart ? (["start"] as const) : []), ...about, "age"];
  if (draft.ageGroup === "60plus") return [...first, "quickHealth", "quickWalk", "quickTravel"];
  return [...first, "health", "activities", "travel", "summary"];
}

/** The same place in the other layout when the text size changes mid-way (by step name, not index). */
export function sameStep(steps: readonly Step[], current: Step): number {
  const found = steps.indexOf(current);
  if (found >= 0) return found;
  const about = current === "about" ? "aboutName" : "about";
  return Math.max(0, steps.indexOf(about));
}

/** Picking an activity fills its defaults (spec 6.1 6a–6c); unpicking drops it. */
export function toggleActivity(activities: readonly ActivityInput[], type: AdultChoice): ActivityInput[] {
  if (activities.some((a) => a.type === type)) return activities.filter((a) => a.type !== type);
  const { band, flex, duration } = CHOICE_DEFAULTS[type];
  return [...activities, { type, band, flex, duration }];
}

/** The "I mostly stay in" tile, which stands alone. */
export const STAY_IN = "stay_in";

/** The activity tiles' new values → the draft: stay-in alone, or the picked activities with their answers kept. */
export function pickActivities(draft: Draft, values: readonly string[]): Partial<Draft> {
  if (values.includes(STAY_IN) && !draft.stayIn) return { stayIn: true, activities: [] };
  const types = values.filter((v): v is AdultChoice => v !== STAY_IN);
  const kept = draft.activities.filter((a) => types.includes(a.type));
  const added = types.filter((type) => !kept.some((a) => a.type === type));
  return { stayIn: false, activities: added.reduce<ActivityInput[]>((list, type) => toggleActivity(list, type), kept) };
}

/** "None" and "Prefer not to say" stand alone; ticking a condition clears them. */
export const toggleConditions = (
  next: readonly ProfileInput["conditions"][number][],
  before: readonly ProfileInput["conditions"][number][],
): ProfileInput["conditions"] => toggleConditionTicks(next, before);

function quickCandidate(draft: Draft): unknown {
  if (!draft.quickTravel) return null;
  const { name, language, conditions, shareWith, quickWalk: walk, quickTravel: travel } = draft;
  return quickProfile({ name, language, textSize: draft.textSize ?? "md", conditions, shareWith, walk, travel });
}

function standardCandidate(draft: Draft): unknown {
  const { main, tripLength, others } = draft.travel;
  if (!main) return null;
  const { name, language, ageGroup, shareWith } = draft;
  const activities = draft.stayIn ? [] : [...draft.activities];
  return {
    name,
    language,
    textSize: draft.textSize ?? "md",
    ageGroup,
    conditions: [...draft.conditions],
    shareWith,
    activities,
    travel: { main, tripLength, others: others.filter((m) => m !== main) },
  };
}

/**
 * The profile to save, or null while a required answer is missing or invalid. 60+ in onboarding
 * takes the quick path's defaults; `full` (Profile settings) always uses the full answers.
 */
export function toInput(draft: Draft, full = false): ProfileInput | null {
  if (!draft.ageGroup) return null;
  const candidate = draft.ageGroup === "60plus" && !full ? quickCandidate(draft) : standardCandidate(draft);
  const parsed = candidate ? profileInput.safeParse(candidate) : null;
  return parsed?.success ? parsed.data : null;
}

/** Whether Next may leave a step (inline errors explain the rest). */
export function stepReady(step: Step, draft: Draft): boolean {
  if (step === "about" || step === "aboutName") return profileInput.shape.name.safeParse(draft.name).success;
  if (step === "age") return draft.ageGroup !== null;
  if (step === "activities") return draft.stayIn || draft.activities.length > 0;
  if (step === "travel") return draft.travel.main !== null;
  if (step === "quickTravel") return draft.quickTravel !== null;
  return true;
}
