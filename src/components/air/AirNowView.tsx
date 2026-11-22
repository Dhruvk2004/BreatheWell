import type { Lang } from "@/i18n/t";
import type { AirNowPage } from "@/view/airNowPage";
import { airHref } from "../place/airHref";
import { PickPlace } from "./AirStates";
import { AirNow } from "./AirNow";

/** Picks the Air now state for a loaded page: no place, over the limit, or the place's air. */
export function AirNowView({ page, lang }: { page: AirNowPage; lang: Lang }) {
  if (page.kind === "no_place") return <PickPlace lang={lang} message="air.pick" />;
  if (page.kind === "rate_limited") return <PickPlace lang={lang} message="air.limited" />;
  const retryHref = airHref({ name: page.place.name ?? "", lat: page.place.lat, lon: page.place.lon, countryCode: null });
  return <AirNow page={page} lang={lang} retryHref={retryHref} />;
}
