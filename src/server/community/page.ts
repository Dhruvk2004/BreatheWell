import { communityTemplate, togetherFor, togetherLine, type CommunityMessage } from "@/ai/community/template";
import type { CommunityOutput, CommunityPromptInput } from "@/ai/community/schema";
import { bandOfAqi } from "@/domain/air/bands";
import { airSummary, type AirSummary } from "@/domain/air/summary";
import { cityAt, isListedGrid } from "@/domain/geo/cities";
import { gridIdOf } from "@/domain/geo/grid";
import { COMMUNITY_ACTIONS, type CommunityAction } from "@/domain/libraries/alternatives";
import { hhmm, LANGS, type Lang } from "@/domain/time/format";
import { formatInstant } from "@/domain/time/instant";
import { bandWordKey } from "@/i18n/labels";
import { t, translator } from "@/i18n/t";
import type { CommunityPage, ShownMessage } from "@/view/community";
import { parsePlaceQuery } from "../air/query";
import { loadAir, type AirDeps } from "../air/service";
import type { AirSnapshot } from "../air/snapshot";
import { checkClient, type RateLimiter } from "../rateLimit";
import { communityWords, type WordsDeps } from "./words";

/**
 * The community message for a place in the URL: the 24-hour average's band and
 * the best window from code, the day's together action chosen by code, and Gemini's words from the
 * shared cache when there are any (else the template, "Simple message"). Public, per-IP limited.
 */
type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

export interface CommunityDeps extends WordsDeps {
  readonly air: AirDeps;
  readonly limiter: RateLimiter;
}

function shown(template: CommunityMessage, words: CommunityOutput | null, lang: Lang): ShownMessage {
  if (!words) return { title: null, ...template };
  const w = words[lang];
  return {
    title: w.title,
    header: template.header,
    body: w.body,
    together: togetherLine(lang, w.together),
    footer: template.footer,
  };
}

interface Day {
  readonly place: string;
  readonly snapshot: AirSnapshot;
  readonly summary: AirSummary & { readonly avg24: number };
}

/** The template in each language with Gemini's words over its middle where there are any. */
function messagesFor(day: Day, together: CommunityAction, words: CommunityOutput | null): Record<Lang, ShownMessage> {
  const { avg24, best, windowDay } = day.summary;
  const band = bandOfAqi(avg24);
  const entries = LANGS.map((lang) => {
    const bandWord = translator(lang)(bandWordKey(band));
    const updated = formatInstant(day.snapshot.fetchedAt, day.snapshot.timeZone, lang);
    const template = communityTemplate({ place: day.place, bandWord, avg24, band, best, windowDay, together, updated }, lang);
    return [lang, shown(template, words, lang)] as const;
  });
  return Object.fromEntries(entries) as Record<Lang, ShownMessage>;
}

/** The prompt input: code values only; the URL's place name never reaches Gemini. */
function promptInput(day: Day, lat: number, lon: number, together: CommunityAction): CommunityPromptInput {
  const { best, worst, windowDay, avg24 } = day.summary;
  return {
    place: cityAt(lat, lon)?.name ?? "India",
    audience: "housing_society",
    band: bandOfAqi(avg24),
    bestWindow: best ? `${hhmm(best.start)}-${hhmm(best.end)}` : null,
    worstWindow: worst ? `${hhmm(worst.start)}-${hhmm(worst.end)}` : null,
    windowDay,
    together,
  };
}

/** Loads the page; `homeCell` is the signed-in viewer's family home cell, which may also use Gemini. */
export async function loadCommunityPage(
  params: SearchParams,
  headers: Headers,
  deps: CommunityDeps,
  homeCell: string | null = null,
): Promise<CommunityPage> {
  const query = parsePlaceQuery(params);
  if (!query) return { kind: "no_place" };
  if (!checkClient(deps.limiter, headers).allowed) return { kind: "rate_limited" };
  const place = query.place || t("en", "air.coordinates", { lat: query.lat.toFixed(2), lon: query.lon.toFixed(2) });
  const snapshot = await loadAir(query, deps.air);
  const summary = snapshot ? airSummary(snapshot.air, { now: deps.now(), timeZone: snapshot.timeZone }) : null;
  if (!snapshot || summary?.avg24 === null || !summary) return { kind: "unavailable", place };
  const day: Day = { place, snapshot, summary: { ...summary, avg24: summary.avg24 } };
  const together = togetherFor(summary.date, COMMUNITY_ACTIONS);
  const gridId = gridIdOf(query.lat, query.lon);
  const input = promptInput(day, query.lat, query.lon, together);
  const { best, worst } = summary;
  const times = [best, worst].flatMap((w) =>
    w
      ? [
          { hour: w.start, minute: 0 },
          { hour: w.end, minute: 0 },
        ]
      : [],
  );
  const eligible = isListedGrid(gridId) || gridId === homeCell;
  const words = await communityWords({ gridId, date: summary.date, hour: summary.hour, eligible, input, times }, deps);
  const band = bandOfAqi(summary.avg24);
  return {
    kind: "ready",
    place,
    band,
    avg24: summary.avg24,
    messages: messagesFor(day, together, words),
    source: words ? "gemini" : "template",
  };
}
