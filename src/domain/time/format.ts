/**
 * Clock times in the two languages. One source for every time a user reads ("3 pm", "दोपहर 3 बजे"),
 * so templates, the kid library and the validator's time allow-list always agree.
 */
export const LANGS = ["en", "hi"] as const;
/** The two app languages (spec F17); i18n re-exports this one declaration. */
export type Lang = (typeof LANGS)[number];

/** True for a supported language code. */
export const isLang = (value: unknown): value is Lang => value === "en" || value === "hi";

/** The language, or English for anything else (a missing or unknown route parameter). */
export const langOf = (value: unknown): Lang => (isLang(value) ? value : "en");

/** Hindi part of the day for an hour 0–23: सुबह (4–11), दोपहर (12–15), शाम (16–19), रात (20–3). */
export function hindiDayPart(hour: number): string {
  if (hour >= 4 && hour < 12) return "सुबह";
  if (hour >= 12 && hour < 16) return "दोपहर";
  if (hour >= 16 && hour < 20) return "शाम";
  return "रात";
}

const twelve = (hour: number) => (hour % 12 === 0 ? 12 : hour % 12);
const meridiem = (hour: number) => (hour < 12 ? "am" : "pm");

/** "3 pm" / "दोपहर 3 बजे"; with minutes "6:30 am" / "सुबह 6:30 बजे". */
export function formatTime(hour: number, minute: number, lang: Lang): string {
  const clock = minute === 0 ? `${twelve(hour)}` : `${twelve(hour)}:${String(minute).padStart(2, "0")}`;
  return lang === "en" ? `${clock} ${meridiem(hour)}` : `${hindiDayPart(hour)} ${clock} बजे`;
}

/** An hour on the clock: "3 pm" / "दोपहर 3 बजे". */
export const formatHour = (hour: number, lang: Lang): string => formatTime(hour, 0, lang);

/** A window of whole hours, end exclusive: "2–4 pm", "11 am–1 pm", "दोपहर 2–4 बजे". */
export function formatWindow(start: number, end: number, lang: Lang): string {
  const endHour = end % 24;
  if (lang === "en") {
    if (meridiem(start) === meridiem(endHour)) return `${twelve(start)}–${twelve(endHour)} ${meridiem(start)}`;
    return `${twelve(start)} ${meridiem(start)}–${twelve(endHour)} ${meridiem(endHour)}`;
  }
  // The window keeps the day part of its hours ("दोपहर 2–4 बजे"), judged on its last whole hour.
  if (hindiDayPart(start) === hindiDayPart((end - 1) % 24)) return `${hindiDayPart(start)} ${twelve(start)}–${twelve(endHour)} बजे`;
  return `${formatHour(start, "hi")}–${formatHour(endHour, "hi")}`;
}

/** Parses "HH:MM" (24 h) into its hour and minute. */
export function parseHhMm(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

/** "HH:00" for a whole hour (24 h), as stored and sent to Gemini. */
export const hhmm = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;
