import type { ValidCard } from "@/ai/breezy/validate";
import { filled } from "@/ai/plan/fields";
import { normaliseNumbers } from "@/ai/shared/normalise";
import { findTimes } from "@/ai/shared/times";
import type { BreezyCard } from "@/domain/breezy/answer";
import { breezySpan } from "@/domain/breezy/activity";
import type { CardTime } from "@/domain/breezy/cardTime";
import type { PersonPlan } from "@/domain/family/people";
import { cardPicture } from "@/domain/impact/cardPicture";
import { passesKidChecks } from "@/domain/libraries/kid";
import type { Verdict } from "@/domain/rules/verdict";
import { addDays, hhmm, parseHhMm } from "@/domain/time";
import type { BreezyContext } from "./context";
import { slotFor, type Slotting } from "./slot";

/**
 * Turns Gemini's checked cards into what the page shows (spec 7.7.3, 7.7.7): tokens become ids, and
 * the rules run again for every proposed time. The chip is the rule's verdict; a card for an Avoid
 * hour moves to the best hour (dropped if its words name a time) or is dropped when the day has none.
 */
const namesATime = (card: ValidCard): boolean =>
  [card.title, card.why, card.item.en, card.item.hi].some((text) => findTimes(normaliseNumbers(text)).length > 0);

function base(card: ValidCard, forId: string | null, nameOf: Readonly<Record<string, string>>): BreezyCard {
  const item = { en: filled(card.item.en, nameOf), hi: filled(card.item.hi, nameOf) };
  return {
    title: filled(card.title, nameOf),
    forId,
    date: card.date,
    time: null,
    activity: card.activityType,
    verdict: null,
    why: filled(card.why, nameOf),
    factId: card.factId,
    action: card.action,
    item,
    // Whether a dependent's kid card may show it (spec 7.7.6); the page uses it only for dependents.
    onCard: passesKidChecks(item.en) && passesKidChecks(item.hi),
  };
}

/** The time and chip a slot gives the card, or null when the card cannot keep its words there. */
function shownSlot(card: ValidCard, time: string, slot: CardTime): { time: string; verdict: Verdict } | null {
  if (slot.kind === "keep") return { time, verdict: slot.verdict };
  if (slot.kind === "moved" && !namesATime(card)) return { time: hhmm(slot.hour), verdict: slot.verdict };
  return null;
}

/** Each planned person's slot for a card that came back without a person ("Who is this for?"). */
function slotsFor(card: ValidCard, time: string, s: Slotting): BreezyCard["slots"] {
  return Object.fromEntries(s.ctx.day.rows.map((row) => [row.person.id, shownSlot(card, time, slotFor(row, s))]));
}

/** "Picture it" for an adult's timed card (spec 7.7.3); never for a dependent. */
function pictureFor(row: PersonPlan, s: Slotting, time: string): BreezyCard["picture"] {
  if (row.person.kind !== "adult") return undefined;
  const { summary } = s.ctx.day;
  const date = s.date === "today" ? summary.date : addDays(summary.date, 1);
  const picture = cardPicture(summary.index, date, parseHhMm(time).hour, breezySpan(s.activity));
  return picture ? { lessPercent: picture.lessPercent, thanTime: hhmm(picture.thanHour), dayOutside: picture.dayOutside } : undefined;
}

/** One card as shown, or null when the rules drop it. */
export function resolveCard(card: ValidCard, ctx: BreezyContext): BreezyCard | null {
  const forId = card.forToken ? (ctx.idOf[card.forToken] ?? null) : null;
  const row = ctx.day.rows.find((r) => r.person.id === forId);
  const shown = base(card, forId, ctx.check.nameOf);
  if (card.time === null || card.activityType === null) return shown;
  const s = { ctx, date: card.date, activity: card.activityType, hour: parseHhMm(card.time).hour };
  if (!row) return { ...shown, slots: slotsFor(card, card.time, s) };
  const slot = shownSlot(card, card.time, slotFor(row, s));
  if (!slot) return null;
  const picture = pictureFor(row, s, slot.time);
  return picture ? { ...shown, ...slot, picture } : { ...shown, ...slot };
}

/** The cards that survive the rules, in Gemini's order. */
export const resolveCards = (cards: readonly ValidCard[], ctx: BreezyContext): BreezyCard[] =>
  cards.flatMap((c) => resolveCard(c, ctx) ?? []);
