import { bandRank, type Band } from "../air/bands";
import type { Bilingual } from "../impact/facts";
import { hasPurifier, type HomeSetup } from "./homeSetup";

/** A home tip for "At home today". `{time}` is filled by code with the airing hour. */
export interface Tip {
  readonly id: TipId;
  readonly text: Bilingual;
  readonly factId: string;
}

export type TipId =
  | "open_windows_clean"
  | "shut_windows_till_noon"
  | "keep_windows_shut"
  | "air_out_best_hour"
  | "purifier_clean_room"
  | "make_clean_room"
  | "no_incense_coils"
  | "wet_mop"
  | "chimney_on"
  | "vent_recirculate"
  | "lpg_over_solid"
  | "smoke_outside";

const t = (id: TipId, en: string, hi: string, factId: string): Tip => ({ id, text: { en, hi }, factId });

export const TIPS: readonly Tip[] = [
  t("open_windows_clean", "Open the windows and let fresh air in today.", "आज खिड़कियाँ खोलें और ताज़ी हवा आने दें।", "air_out_short"),
  t("shut_windows_till_noon", "Keep windows shut till noon.", "दोपहर तक खिड़कियाँ बंद रखें।", "windows_shut_morning"),
  t(
    "keep_windows_shut",
    "Keep windows shut today; use the exhaust fan while cooking.",
    "आज खिड़कियाँ बंद रखें; खाना बनाते समय एग्ज़ॉस्ट फ़ैन चलाएँ।",
    "windows_shut_morning",
  ),
  t(
    "air_out_best_hour",
    "Open windows for 15 minutes at {time}, then shut them.",
    "{time} 15 मिनट खिड़कियाँ खोलें, फिर बंद कर दें।",
    "air_out_short",
  ),
  t(
    "purifier_clean_room",
    "Run the purifier on high in one room with the door shut.",
    "एक कमरे में दरवाज़ा बंद करके प्यूरीफ़ायर तेज़ चलाएँ।",
    "purifier_room_door",
  ),
  t(
    "make_clean_room",
    "Make one clean room: keep it shut and free of smoke.",
    "एक साफ़ कमरा बनाएँ: उसे बंद रखें और वहाँ धुआँ न होने दें।",
    "clean_room",
  ),
  t("no_incense_coils", "No incense or coils today.", "आज अगरबत्ती या कॉइल न जलाएँ।", "incense_pm"),
  t("wet_mop", "Wet-mop the floor instead of sweeping.", "झाड़ू की जगह गीला पोंछा लगाएँ।", "wet_mop_vs_sweep"),
  t("chimney_on", "Run the chimney or exhaust fan while you cook.", "खाना बनाते समय चिमनी या एग्ज़ॉस्ट फ़ैन चलाएँ।", "chimney_on"),
  t(
    "vent_recirculate",
    "Set the AC to recirculate during the worst hours.",
    "सबसे खराब घंटों में AC को रीसर्कुलेट पर रखें।",
    "fresh_air_vent",
  ),
  t(
    "lpg_over_solid",
    "Cook on LPG today if you can, not wood or coal.",
    "हो सके तो आज लकड़ी या कोयले की जगह LPG पर खाना बनाएँ।",
    "solid_fuel_smoke",
  ),
  t(
    "smoke_outside",
    "If anyone smokes, please do it outside, away from windows.",
    "अगर कोई धूम्रपान करता है, तो कृपया बाहर और खिड़कियों से दूर करें।",
    "indoor_smoking",
  ),
];

const BY_ID = new Map(TIPS.map((tip) => [tip.id, tip]));

/** A tip by id. */
export const tipById = (id: TipId): Tip => BY_ID.get(id) as Tip;

/** Spec 8.4 step 8: airing tip at the best hour, or "keep windows shut today". */
function windowTip(airOutAt: number | null): TipId {
  return airOutAt === null ? "keep_windows_shut" : "air_out_best_hour";
}

/**
 * The three band-based tips for Air now "At home today", code only, no sign-in.
 * Clean air: open up; Moderate: air out, wet-mop, chimney; Poor or worse: shut till noon, air out
 * at the best hour (or keep shut), no incense or coils.
 */
export function bandTips(band: Band, airOutAt: number | null): TipId[] {
  if (bandRank(band) <= bandRank("satisfactory")) return ["open_windows_clean", "wet_mop", "chimney_on"];
  if (band === "moderate") return [windowTip(airOutAt), "wet_mop", "chimney_on"];
  if (airOutAt === null) return ["keep_windows_shut", "no_incense_coils", "chimney_on"];
  return ["shut_windows_till_noon", "air_out_best_hour", "no_incense_coils"];
}

/**
 * Home tips that fit this family's set-up, most important first; the plan prompt's
 * `allowedTips` and the template's "At home" block both come from this list.
 */
export function homeTips(home: HomeSetup, band: Band, airOutAt: number | null): TipId[] {
  const ids: TipId[] = [];
  if (home.indoorSmoking === "yes") ids.push("smoke_outside");
  if (home.fuel === "solid") ids.push("lpg_over_solid");
  ids.push(...bandTips(band, airOutAt));
  ids.push(hasPurifier(home) ? "purifier_clean_room" : "make_clean_room");
  if (home.incense !== "never") ids.push("no_incense_coils");
  if (home.freshAirVent) ids.push("vent_recirculate");
  ids.push("chimney_on", "wet_mop");
  const fits = (id: TipId) => id !== "no_incense_coils" || home.incense !== "never";
  return ids.filter((id, i) => ids.indexOf(id) === i && fits(id));
}
