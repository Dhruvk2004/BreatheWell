import { bandRank, displayAqi, type Band } from "@/domain/air/bands";
import type { WindowDay } from "@/domain/air/summary";
import type { HourWindow } from "@/domain/air/windows";
import type { CommunityAction } from "@/domain/libraries/alternatives";
import { formatHour, formatWindow, type Lang } from "@/domain/time/format";
import { t } from "@/i18n/t";

/**
 * The template community message, one per band, audience and together
 * action, used when there is no Gemini message, labelled "Simple message". Code writes the header numbers and the footer; the body has
 * no air numbers and never a cigarette comparison. The copy lives in the i18n files (`community.t.*`).
 */
export interface CommunityInput {
  readonly place: string;
  /** The 24-hour average's band word in this language ("Very poor"), and the value. */
  readonly bandWord: string;
  readonly avg24: number;
  readonly band: Band;
  readonly best: HourWindow | null;
  /** Which day `best` is on: after 9 pm it is tomorrow's window. */
  readonly windowDay: WindowDay;
  readonly together: CommunityAction;
  /** "7:00 am", the air reading's time. */
  readonly updated: string;
}

export interface CommunityMessage {
  readonly header: string;
  readonly body: string;
  readonly together: string;
  readonly footer: string;
}

const dayOf = (windowDay: WindowDay) => (windowDay === "tomorrow" ? "tomorrow" : "today");

function bodyGroup(band: Band): "clean" | "moderate" | "poor" | "severe" {
  if (band === "severe") return "severe";
  if (bandRank(band) >= bandRank("poor")) return "poor";
  return band === "moderate" ? "moderate" : "clean";
}

function header(input: CommunityInput, lang: Lang): string {
  const best = input.best;
  const tail = best ? ` · ${t(lang, `community.t.best.${dayOf(input.windowDay)}`)} ${formatWindow(best.start, best.end, lang)}` : "";
  return t(lang, "community.t.header", { place: input.place, band: input.bandWord, avg: displayAqi(input.avg24), tail });
}

/** The day's together line with its "Together today:" lead, from one source (`community.together`). */
export const togetherLine = (lang: Lang, words: string): string => `${t(lang, "community.together")} ${words}`;

/** The message in one language; every word comes from `en.json` / `hi.json`. */
export function communityTemplate(input: CommunityInput, lang: Lang): CommunityMessage {
  const best = input.best;
  const play = best ? ` ${t(lang, `community.t.play.${dayOf(input.windowDay)}`, { time: formatHour(best.start, lang) })}` : "";
  return {
    header: header(input, lang),
    body: t(lang, `community.t.body.${bodyGroup(input.band)}`, { play }),
    together: togetherLine(lang, t(lang, `community.t.together.${input.together}`)),
    footer: t(lang, "community.t.footer", { updated: input.updated }),
  };
}

/** The day's together action, rotating through the list so a group does not get the same line daily. */
export function togetherFor(date: string, actions: readonly CommunityAction[]): CommunityAction {
  const day = Number(date.slice(8, 10));
  return actions[day % actions.length];
}
