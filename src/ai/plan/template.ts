import type { ActivityType } from "@/domain/rules/activities";
import { isEnclosed, type Mode } from "@/domain/rules/modes";
import type { ActivityPlan } from "@/domain/rules/plan";
import { formatHour, formatTime, parseHhMm, type Lang } from "@/domain/time/format";

/**
 * The template plan's one-line row text (spec 7.2 fallback, design 10.8 "one line"): what the
 * person changes, written by code from the rule result, in English or Hindi. It is what every row
 * shows before (or instead of) Gemini's wording, labelled "Simple plan". Every time comes from the
 * rule; nothing here decides a verdict.
 */
export interface RowLineInput {
  readonly type: ActivityType;
  /** Usual start, "HH:MM". */
  readonly usual: string;
  readonly mainMode: Mode;
  readonly plan: ActivityPlan;
}

type Words = Readonly<Record<Lang, string>>;
const w = (en: string, hi: string): Words => ({ en, hi });

/** Short activity words for row lines (the onboarding labels are too long for a row). */
const ACTIVITY: Readonly<Record<ActivityType, Words>> = {
  morning_walk: w("Walk", "सैर"),
  evening_walk: w("Walk", "सैर"),
  school_trip: w("School trip", "स्कूल जाना"),
  office_trip: w("Office trip", "दफ़्तर जाना"),
  sport: w("Sport", "खेलकूद"),
  errands: w("Errands", "बाज़ार का काम"),
  tuition: w("Tuition", "ट्यूशन"),
  play: w("Play", "बाहर खेलना"),
  cycling: w("Cycling", "साइकिल चलाना"),
};

/** Mode words; open modes appear only in "protect", enclosed ones also as a switch target. */
const MODE: Readonly<Record<Mode, Words>> = {
  walk: w("Walk", "पैदल"),
  cycle: w("Cycle", "साइकिल"),
  two_wheeler: w("Scooter", "स्कूटर"),
  auto_bus: w("Auto or bus", "ऑटो या बस"),
  auto_van: w("Auto or van", "ऑटो या वैन"),
  school_bus: w("School bus", "स्कूल बस"),
  metro: w("Metro", "मेट्रो"),
  carpool: w("Carpool", "कारपूल"),
  car: w("Car", "कार"),
  home: w("Home", "घर"),
};

/** "Walk in the hall today", "Play inside today": the indoor alternative per activity. */
const INDOOR: Readonly<Record<ActivityType, Words>> = {
  morning_walk: w("Walk in the hall today, not at {usual}.", "आज सैर घर के अंदर करें, बाहर नहीं।"),
  evening_walk: w("Walk in the hall today, not at {usual}.", "आज सैर घर के अंदर करें, बाहर नहीं।"),
  sport: w("Indoor games today, not outside.", "आज खेलकूद घर के अंदर, बाहर नहीं।"),
  play: w("Play inside today.", "आज घर के अंदर खेलें।"),
  cycling: w("No cycling outside today.", "आज बाहर साइकिल नहीं।"),
  errands: w("Put off errands today if you can.", "हो सके तो आज बाज़ार का काम टालें।"),
  tuition: w("Tuition: stay home today if you can.", "ट्यूशन: हो सके तो आज घर पर रहें।"),
  school_trip: w("School trip: shortest route, mask on.", "स्कूल जाना: छोटा रास्ता, मास्क पहनें।"),
  office_trip: w("Office trip: shortest route, mask on.", "दफ़्तर जाना: छोटा रास्ता, मास्क पहनें।"),
};

/** What the person is switching away from, ready for "not …". */
const FROM: Readonly<Record<Mode, Words>> = {
  walk: w("on foot", "पैदल"),
  cycle: w("the cycle", "साइकिल से"),
  two_wheeler: w("the scooter", "स्कूटर से"),
  auto_bus: w("the auto or bus", "ऑटो या बस से"),
  auto_van: w("the auto or van", "ऑटो या वैन से"),
  school_bus: w("the school bus", "स्कूल बस से"),
  metro: w("the metro", "मेट्रो से"),
  carpool: w("the carpool", "कारपूल से"),
  car: w("the car", "कार से"),
  home: w("from home", "घर से"),
};

const fill = (text: string, slots: Readonly<Record<string, string>>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? "");

const usualTime = (usual: string, lang: Lang): string => {
  const { hour, minute } = parseHhMm(usual);
  return formatTime(hour, minute, lang);
};

/** A trip done as planned but with care: what protects in that mode. */
function protectTrip(mode: Mode, lang: Lang): string {
  if (mode === "car")
    return lang === "en" ? "{mode} at {usual}: windows up, air on recirculate." : "{mode} {usual}: खिड़कियाँ बंद, AC रीसर्कुलेट पर।";
  if (isEnclosed(mode)) return lang === "en" ? "{mode} at {usual}: keep a mask handy." : "{mode} {usual}: मास्क साथ रखें।";
  return lang === "en" ? "{mode} at {usual}: N95 on, shortest route." : "{mode} {usual}: N95 पहनें, छोटा रास्ता लें।";
}

const TEXT = {
  as_planned: w("{act} at {usual}: go as planned.", "{act} {usual}: तय समय पर करें।"),
  protect: w("{act} at {usual}, at an easy pace.", "{act} {usual}: धीरे-धीरे, ध्यान से।"),
  move_time: w("{act} at {best}, not {usual}.", "{act} {best}, {usual} नहीं।"),
  switch_mode: w("Take the {to} at {usual}, not {from}.", "{usual} {to} से जाएँ, {from} नहीं।"),
} as const;

/** The template sentence for a rule result, before its slots are filled. */
function pattern(input: RowLineInput, lang: Lang): string {
  const { plan, type, mainMode } = input;
  if (plan.suggestion === "indoor") return INDOOR[type][lang];
  if (plan.suggestion === "switch_mode") return TEXT.switch_mode[lang];
  if (plan.suggestion === "move_time") return TEXT.move_time[lang];
  const trip = type === "school_trip" || type === "office_trip" || type === "tuition";
  if (trip && plan.suggestion === "protect") return protectTrip(mainMode, lang);
  return TEXT[plan.suggestion][lang];
}

/** The row's one line, e.g. "Walk at 3 pm, not 6:30 am." / "सैर दोपहर 3 बजे, सुबह 6:30 बजे नहीं।" */
export function rowLine(input: RowLineInput, lang: Lang): string {
  const { plan } = input;
  const target = plan.switchTo ?? input.mainMode;
  return fill(pattern(input, lang), {
    act: ACTIVITY[input.type][lang],
    usual: usualTime(input.usual, lang),
    best: plan.bestTime === null ? "" : formatHour(plan.bestTime, lang),
    mode: MODE[input.mainMode][lang],
    to: lang === "en" ? MODE[target].en.toLowerCase() : MODE[target].hi,
    from: FROM[input.mainMode][lang],
  });
}

/** "Tomorrow 3 pm looks better." when nothing today beats Avoid, else null. */
export function tomorrowLine(plan: ActivityPlan, lang: Lang): string | null {
  if (plan.tomorrowBest === null) return null;
  const time = formatHour(plan.tomorrowBest, lang);
  return lang === "en" ? `Tomorrow ${time} looks better.` : `कल ${time} बेहतर लगता है।`;
}
