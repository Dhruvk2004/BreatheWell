import { DAY_FIRST_HOUR, DAY_LAST_HOUR } from "@/domain/air/windows";
import type { BreezyActivity } from "@/domain/breezy/activity";
import { containsPhrase } from "@/domain/names/words";
import { normaliseNumbers } from "../shared/normalise";
import { activityIn } from "../shared/outing";
import { clauses, isCancelled } from "../shared/skip";
import { nfc, sentences } from "../shared/text";
import { findTimes, type FoundTime } from "../shared/times";

/**
 * The rules on every time inside Breezy's free text: when a clause names a time
 * and an outing ("walk", "play outside", "सुबह 8 बजे बाहर खेलें"), the rules judge that hour for the
 * people it is about, and an hour they do not allow (Avoid, past, a Severe day) rejects the text.
 * Used on the reply, every card field and again on the confirmed action. Pure: the rules come in as
 * `allowed`.
 */
export type CardDate = "today" | "tomorrow";

/** True when the rules allow this person this activity at this hour (keyed by token or id). */
export type HourAllowed = (person: string, activity: BreezyActivity, date: CardDate, hour: number) => boolean;

export interface TimeScope {
  /** Every person key the text may name as `{key}`. */
  readonly people: readonly string[];
  /** Who the text is about when it names nobody (the card's person, or the viewer); empty for anyone. */
  readonly defaults: readonly string[];
  readonly date: CardDate;
  readonly allowed: HourAllowed;
}

const TOMORROW = ["tomorrow", "कल"];

/** The start hours a time may mean inside the plannable day ("3 बजे" may be 3:00 or 15:00). */
const startHours = (time: FoundTime): number[] => time.hours[0].filter((h) => h >= DAY_FIRST_HOUR && h <= DAY_LAST_HOUR);

/** Who a sentence is about and on which day. `anyone`: nobody named, so one allowed person is enough. */
interface Target {
  readonly who: readonly string[];
  readonly anyone: boolean;
  readonly date: CardDate;
}

/** True when no reading of the time is allowed for the target's people. */
function timeRejected(time: FoundTime, activity: BreezyActivity, target: Target, allowed: HourAllowed): boolean {
  const hours = startHours(time);
  if (hours.length === 0 || target.who.length === 0) return false;
  const ok = (person: string, hour: number) => allowed(person, activity, target.date, hour);
  const fits = (hour: number) => (target.anyone ? target.who.some((p) => ok(p, hour)) : target.who.every((p) => ok(p, hour)));
  return !hours.some(fits);
}

/** The people and day a sentence is about. */
function targetOf(sentence: string, scope: TimeScope): Target {
  const named = scope.people.filter((p) => sentence.includes(`{${p}}`));
  const anyone = named.length === 0 && scope.defaults.length === 0;
  const who = named.length ? named : anyone ? scope.people : scope.defaults;
  const date: CardDate = TOMORROW.some((w) => containsPhrase(sentence, w)) ? "tomorrow" : scope.date;
  return { who, anyone, date };
}

/**
 * "at 8", "around 7", "after 6" next to an outing are clock readings too, not small counts (stage
 * 7 AI-1): "Walk at 8 today" may mean 8:00 or 20:00, and the rules judge both.
 */
const BARE =
  /(?<![\p{L}])(?:at|around|by|after|before|till|until)\s+(\d{1,2})(?![\d:.%]|\s*(?:am|pm|a\.m|p\.m|o['’]?\s?clock|baje|bje|बजे|minutes?|mins?|hours?|hrs?|मिनट|घंटे|in\s+the|this|tonight)(?![\p{L}]))/giu;

/** Every time in a clause, bare "at 8" readings included. */
function timesIn(clause: string): FoundTime[] {
  const bare = [...clause.matchAll(BARE)].map((m): FoundTime => {
    const h = Number(m[1]);
    return { text: m[0], hours: [h === 12 ? [12, 0] : [h, h + 12]], minutes: [0] };
  });
  return [...findTimes(clause), ...bare];
}

/** The clause's outing, or the sentence's when the time's clause is the sentence's only timed one. */
function outingFor(clause: string, sentence: string, timedClauses: number): BreezyActivity | null {
  return activityIn(clause) ?? (timedClauses === 1 ? activityIn(sentence) : null);
}

/** True when one sentence recommends an outing at a time the rules do not allow. */
function sentenceRejected(sentence: string, scope: TimeScope): boolean {
  const target = targetOf(sentence, scope);
  const parts = clauses(sentence);
  const timed = parts.filter((c) => timesIn(c).length > 0).length;
  return parts.some((clause) => {
    const activity = outingFor(clause, sentence, timed);
    if (!activity) return false;
    return timesIn(clause).some((t) => !isCancelled(clause, t) && timeRejected(t, activity, target, scope.allowed));
  });
}

/**
 * True when any sentence of the text puts an outing at an hour the rules do not allow. Number words
 * and Devanagari digits count ("eight am", "आठ बजे", "८ बजे": stage 7 AI-1).
 */
export const rejectsTime = (text: string, scope: TimeScope): boolean =>
  sentences(normaliseNumbers(nfc(text))).some((s) => sentenceRejected(s, scope));
