import { checkText } from "@/ai/shared/validate";
import type { ClockTime } from "@/ai/shared/times";
import { LANGS, type Lang } from "@/domain/time/format";
import { agreesWithBand } from "./bandCheck";
import { COMMUNITY_CAPS, communityOutputSchema, type CommunityOutput, type CommunityPromptInput, type CommunityWords } from "./schema";

/**
 * The community message validator (spec 7.1, 7.6): every field in both languages passes the shared
 * checks (length, language, no air numbers, no cigarettes or other banned content) and agrees with
 * the band and the best window from code (`bandCheck`). Shared
 * messages never carry a cigarette comparison, so the cigarette ban here is absolute. Any failure
 * means the template message ("Simple message").
 */
function fieldOk(text: string, lang: Lang, cap: number, times: readonly ClockTime[]): boolean {
  return checkText(text, { lang, maxLength: cap, allowedTimes: times, names: [], forDependent: false }).length === 0;
}

type BandFacts = Pick<CommunityPromptInput, "band" | "bestWindow">;

const wordsOk = (w: CommunityWords, lang: Lang, times: readonly ClockTime[], band: BandFacts): boolean =>
  fieldOk(w.title, lang, COMMUNITY_CAPS.title, times) &&
  fieldOk(w.body, lang, COMMUNITY_CAPS.body, times) &&
  fieldOk(w.together, lang, COMMUNITY_CAPS.together, times) &&
  [w.title, w.body].every((text) => agreesWithBand(text, band));

/** The reply when the JSON, its shape and every field pass; null otherwise. */
export function validateCommunity(raw: string, times: readonly ClockTime[], band: BandFacts): CommunityOutput | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = communityOutputSchema.safeParse(value);
  if (!parsed.success) return null;
  const trimmed = Object.fromEntries(
    LANGS.map((l) => [
      l,
      { title: parsed.data[l].title.trim(), body: parsed.data[l].body.trim(), together: parsed.data[l].together.trim() },
    ]),
  ) as CommunityOutput;
  return LANGS.every((l) => wordsOk(trimmed[l], l, times, band)) ? trimmed : null;
}
