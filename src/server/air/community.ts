import { communityTemplate, togetherFor, type CommunityMessage } from "@/ai/community/template";
import { bandOfAqi } from "@/domain/air/bands";
import { COMMUNITY_ACTIONS } from "@/domain/libraries/alternatives";
import type { AirNowModel } from "@/domain/public/airNow";
import { formatInstant } from "@/domain/time/instant";
import { bandWordKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";

/** Where and when the message is for: the place's display name and the reading's time. */
export interface CommunityFor {
  readonly place: string;
  readonly fetchedAt: Date;
  readonly timeZone: string;
}

/**
 * The Air now community message (spec 7.6, 10.2 item 8) as the template, in the page language: the
 * 24-hour average's band, the best window with its day, and the day's together action. Null without
 * a 24-hour average (no numbers to put in the header).
 */
export function airNowCommunity(model: AirNowModel, at: CommunityFor, lang: Lang): CommunityMessage | null {
  const { avg24, best, windowDay, date } = model.summary;
  if (avg24 === null) return null;
  const band = bandOfAqi(avg24);
  return communityTemplate(
    {
      place: at.place,
      bandWord: translator(lang)(bandWordKey(band)),
      avg24,
      band,
      best,
      windowDay,
      together: togetherFor(date, COMMUNITY_ACTIONS),
      updated: formatInstant(at.fetchedAt, at.timeZone, lang),
    },
    lang,
  );
}
