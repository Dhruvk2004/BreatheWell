import type { Band } from "../../air/bands";
import type { ActivityType } from "../../rules/activities";
import type { Mode } from "../../rules/modes";
import type { Lang } from "../../time/format";
import type { KidActivity } from "./lines";

const b = (en: string, hi: string) => ({ en, hi });

/** "The air is …" by band, in kid words: no numbers, nothing scary (spec 10.12). */
export const KID_HEADLINE: Readonly<Record<Band, { en: string; hi: string }>> = {
  good: b("The air is clean {part}", "{part} हवा साफ़ है"),
  satisfactory: b("The air is okay {part}", "{part} हवा ठीक है"),
  moderate: b("The air is a little smoky {part}", "{part} हवा में थोड़ा धुआँ है"),
  poor: b("The air is unhealthy {part}", "{part} हवा खराब है"),
  very_poor: b("The air is very unhealthy {part}", "{part} हवा बहुत खराब है"),
  severe: b("The air is very smoky {part}. Stay inside.", "{part} हवा में बहुत धुआँ है। घर में रहो।"),
};

/** "this morning" before noon, otherwise "today". */
export const partOfDay = (hour: number, lang: Lang): string =>
  hour < 12 ? (lang === "en" ? "this morning" : "आज सुबह") : lang === "en" ? "today" : "आज";

/** Labels on the card's activity lines. */
export const KID_LABEL: Readonly<Record<ActivityType, { en: string; hi: string }>> = {
  school_trip: b("School", "स्कूल"),
  tuition: b("Tuition", "ट्यूशन"),
  play: b("Play", "खेल"),
  cycling: b("Cycling", "साइकिल"),
  sport: b("Sports", "खेलकूद"),
  morning_walk: b("Walk", "सैर"),
  evening_walk: b("Walk", "सैर"),
  errands: b("Outside", "बाहर"),
  office_trip: b("Trip", "सफ़र"),
};

/** Mode words in kid language. */
export const KID_MODE: Readonly<Record<Mode, { en: string; hi: string }>> = {
  school_bus: b("bus", "बस"),
  metro: b("metro", "मेट्रो"),
  carpool: b("carpool", "कारपूल"),
  car: b("car", "कार"),
  auto_bus: b("bus", "बस"),
  auto_van: b("van", "वैन"),
  walk: b("walk", "पैदल"),
  cycle: b("cycle", "साइकिल"),
  two_wheeler: b("scooter", "स्कूटर"),
  home: b("home", "घर"),
};

/** The kid library's activity group for an activity type. */
export function kidActivityOf(type: ActivityType): KidActivity {
  if (type === "school_trip" || type === "tuition" || type === "office_trip") return "travel";
  if (type === "cycling") return "cycling";
  if (type === "sport") return "sport";
  return "play";
}

/** Share emoji by band (design G): 🟢 Good and Satisfactory · 🟡 Moderate · 🟠 Poor · 🔴 Very poor · 🟤 Severe. */
export const BAND_EMOJI: Readonly<Record<Band, string>> = {
  good: "🟢",
  satisfactory: "🟢",
  moderate: "🟡",
  poor: "🟠",
  very_poor: "🔴",
  severe: "🟤",
};
