import { checkText, type FieldRules } from "@/ai/shared/validate";
import type { ClockTime } from "@/ai/shared/times";
import { isFactId } from "@/domain/impact/facts";
import type { Lang } from "@/domain/time/format";
import { filled } from "../plan/fields";
import { isDependentToken, PLAN_TOKEN } from "../plan/tokens";
import { replyContradictions } from "./contradiction";
import { rejectsTime, type CardDate, type HourAllowed } from "./timeCheck";
import { breezyOutputSchema, MAX_CARDS, type BreezyInput, type BreezyOutput, type BreezyOutputCard } from "./schema";

/**
 * Breezy's validator (spec 7.1, 7.7.7): the reply text and every card field go through the shared
 * checks (length after names are filled in, language, numbers, banned content incl. harmful advice
 * and system leaks, name leaks) and the rules on every time it names (`timeCheck`); the reply also
 * through the plan's contradiction check. A failing reply means the fixed "basics" fallback; a
 * failing card is dropped on its own.
 */
export const BREEZY_CAPS = { reply: 400, title: 50, why: 140, item: 100 } as const;

export interface BreezyCheck {
  readonly input: BreezyInput;
  /** Every name and alias in the family: Gemini never received one, so any of them is a leak. */
  readonly names: readonly string[];
  /** Token → name, to measure text as shown. */
  readonly nameOf: Readonly<Record<string, string>>;
  readonly allowedTimes: readonly ClockTime[];
  /** The rules for a person (token), activity and hour: every time in the free text is judged. */
  readonly allowed: HourAllowed;
}

export interface ValidCard extends Omit<BreezyOutputCard, "forMemberId"> {
  /** The person's token, or null ("Who is this for?"). */
  readonly forToken: string | null;
}

export interface ValidReply {
  readonly text: string;
  readonly lang: Lang;
  readonly cards: readonly ValidCard[];
  readonly refusal: BreezyOutput["refusal"];
}

function parse(raw: string): BreezyOutput | null {
  try {
    const result = breezyOutputSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Reasons a text is rejected, measured as shown. A dependent's text also may not use fear words; the
 * kid-card checks are not a rejection here: a card that fails them is still offered, and its item
 * stays on the parent's view only (spec 7.7.6).
 */
interface About {
  /** Who the text is about when it names nobody. */
  readonly defaults: readonly string[];
  readonly date: CardDate;
  readonly forDependent: boolean;
}

function problems(text: string, lang: Lang, cap: number, check: BreezyCheck, about: About): string[] {
  const tokens = [...text.matchAll(PLAN_TOKEN)].map((m) => m[1]);
  const reasons: string[] = tokens.some((t) => !(t in check.nameOf)) ? ["unknown_token"] : [];
  if ([...filled(text, check.nameOf).trim()].length > cap) reasons.push("too_long");
  const rules: FieldRules = {
    lang,
    maxLength: Number.MAX_SAFE_INTEGER,
    allowedTimes: check.allowedTimes,
    names: check.names,
    forDependent: about.forDependent,
  };
  reasons.push(...checkText(text, rules));
  const people = check.input.people.map((p) => p.id);
  if (rejectsTime(text, { people, defaults: about.defaults, date: about.date, allowed: check.allowed })) reasons.push("time_not_allowed");
  return reasons;
}

/** A card when every field passes and its ids come from the input; null otherwise. */
function validCard(card: BreezyOutputCard, check: BreezyCheck, lang: Lang): ValidCard | null {
  const { forMemberId, ...rest } = card;
  const known = check.input.people.some((p) => p.id === forMemberId);
  if (forMemberId !== null && !known) return null;
  if (card.factId !== null && (!isFactId(card.factId) || !check.input.allowedFacts.includes(card.factId))) return null;
  if (card.action === "add_to_plan" && (card.time === null || card.activityType === null)) return null;
  const about: About = {
    defaults: forMemberId === null ? [] : [forMemberId],
    date: card.date,
    forDependent: forMemberId !== null && isDependentToken(forMemberId),
  };
  const failed = [
    ...problems(card.title, lang, BREEZY_CAPS.title, check, about),
    ...problems(card.why, lang, BREEZY_CAPS.why, check, about),
    ...problems(card.item.en, "en", BREEZY_CAPS.item, check, about),
    ...problems(card.item.hi, "hi", BREEZY_CAPS.item, check, about),
  ];
  return failed.length === 0 ? { ...rest, forToken: forMemberId } : null;
}

/** Checks a reply; null when the JSON, its shape or the reply text is unusable. */
export function validateBreezy(raw: string, check: BreezyCheck): ValidReply | null {
  const reply = parse(raw);
  const lang = check.input.viewerLanguage;
  if (!reply || reply.reply.lang !== lang) return null;
  const text = reply.reply.text.trim();
  const mentionsDependent = [...text.matchAll(PLAN_TOKEN)].some((m) => isDependentToken(m[1]));
  const viewer = check.input.viewer;
  const about: About = { defaults: viewer ? [viewer] : [], date: "today", forDependent: mentionsDependent };
  const failed = [
    ...problems(text, lang, BREEZY_CAPS.reply, check, about),
    ...replyContradictions(text, check.input.people, check.input.viewer),
  ];
  if (text.length === 0 || failed.length > 0) return null;
  const cards = reply.cards.flatMap((c) => validCard(c, check, lang) ?? []).slice(0, MAX_CARDS);
  return { text, lang, cards, refusal: reply.refusal };
}
