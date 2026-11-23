import type { Band } from "../air/bands";
import type { ActivityType } from "../rules/activities";
import type { Mode } from "../rules/modes";
import type { ActivityPlan } from "../rules/plan";
import { formatHour, type Lang } from "../time/format";
import { insideIdeas, kidWhy } from "./kid/extras";
import { fillSlots, kidLineTemplate, type KidLineKind, type Tone } from "./kid/lines";
import { BAND_EMOJI, KID_HEADLINE, KID_LABEL, KID_MODE, kidActivityOf, partOfDay } from "./kid/words";

export { kidCardProblems, passesKidChecks, type KidProblem } from "./kid/checks";
export { insideIdeas, kidForAir, kidWhy, INSIDE_IDEAS } from "./kid/extras";
export type { KidActivity, KidLineKind, Tone } from "./kid/lines";

/**
 * The kid library (`domain/libraries/kid.ts`, spec 7.2): every word on a kid card comes from here
 * (plus adult-confirmed Breezy items that pass the kid-card checks). Times come from the rule's
 * `bestTime` / `tomorrowBest`, never typed by hand (design G).
 */
export interface KidItem {
  readonly type: ActivityType;
  readonly plan: ActivityPlan;
  /** The dependent's usual travel mode (teen "Bus today, not the cycle."). */
  readonly mainMode: Mode;
}

/** Under 13 → kid tone; 13–17 → teen tone (spec 6.2). */
export const toneOf = (ageGroup: "under13" | "13to17"): Tone => (ageGroup === "under13" ? "kid" : "teen");

/** The line variant for a rule result. */
export function kidLineKind(plan: ActivityPlan): KidLineKind {
  if (plan.suggestion === "switch_mode") return plan.notes.includes("schools_may_close") ? "switch_severe" : "switch_mode";
  if (plan.suggestion === "protect" && plan.notes.includes("essential_protect")) return "protect_essential";
  return plan.suggestion;
}

/** "Tomorrow 3 pm looks better!" from the rule, or a calm line when no better hour is in sight. */
export function kidWhen(tomorrowBest: number | null, lang: Lang): string {
  if (tomorrowBest === null) return lang === "en" ? "Inside is best today." : "आज अंदर ही अच्छा है।";
  const time = formatHour(tomorrowBest, lang);
  return lang === "en" ? `Tomorrow ${time} looks better!` : `कल ${time} बेहतर लगता है!`;
}

const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase("en-IN") + text.slice(1);

/** One activity line in kid or teen tone, with every slot filled by code. */
export function kidLine(item: KidItem, tone: Tone, lang: Lang): string {
  const { plan } = item;
  const template = kidLineTemplate(tone, lang, kidLineKind(plan), kidActivityOf(item.type));
  const text = fillSlots(template, {
    time: plan.bestTime === null ? "" : formatHour(plan.bestTime, lang),
    when: kidWhen(plan.tomorrowBest, lang),
    mode: plan.switchTo ? KID_MODE[plan.switchTo][lang] : "",
    from: KID_MODE[item.mainMode][lang],
  });
  return lang === "en" ? capitalise(text) : text;
}

export interface KidCardInput {
  readonly band: Band;
  readonly tone: Tone;
  readonly lang: Lang;
  /** Local hour of the clock, for "this morning" vs "today". */
  readonly hour: number;
  readonly date: string;
  readonly items: readonly KidItem[];
  readonly factId: string | null;
}

export interface KidCard {
  readonly headline: string;
  readonly lines: readonly { readonly label: string; readonly text: string }[];
  readonly why: string;
  readonly ideas: readonly string[];
}

/**
 * One label per activity. Two of the same kind (school there and back) get their usual clock time,
 * "School · 7 am" and "School · 1 pm", so a child can tell the rows apart (stage 8 QA8-4).
 */
export function kidLabels(items: readonly KidItem[], lang: Lang): string[] {
  const label = (item: KidItem) => KID_LABEL[item.type][lang];
  return items.map((item) => {
    const twin = items.filter((other) => label(other) === label(item)).length > 1;
    return twin ? `${label(item)} · ${formatHour(item.plan.usualHour, lang)}` : label(item);
  });
}

/** The kid card's content (spec 10.12): headline, one line per activity, a kid "Why?" and 3 inside ideas. */
export function kidCard(input: KidCardInput): KidCard {
  const { lang } = input;
  return {
    headline: fillSlots(KID_HEADLINE[input.band][lang], { part: partOfDay(input.hour, lang) }),
    lines: kidLabels(input.items, lang).map((label, i) => ({ label, text: kidLine(input.items[i], input.tone, lang) })),
    why: kidWhy(input.factId, lang),
    ideas: insideIdeas(input.date, lang),
  };
}

/**
 * The WhatsApp share text (spec 5.5 step 6, design 10.12): first name, band word, the lines and the
 * "when", with the band emoji. Never numbers other than clock times, never cigarettes.
 */
export function kidShareText(name: string, band: Band, card: KidCard, lang: Lang): string {
  const air = fillSlots(KID_HEADLINE[band][lang], { part: "" });
  const title = lang === "en" ? `${name}'s air card for today` : `${name} का आज का हवा कार्ड`;
  const end = lang === "en" ? "." : "।";
  const airSentence = /[.।]$/.test(air) ? air : `${capitalise(air)}${end}`;
  return `${title} ${BAND_EMOJI[band]} ${airSentence} ${card.lines.map((l) => l.text).join(" ")} – BreatheWell`;
}
