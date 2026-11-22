import { localTime } from "./clock";
import { formatTime, type Lang } from "./format";

/** An instant as a clock time in a place's zone: "6:10 am" / "सुबह 6:10 बजे" (source lines, banners). */
export function formatInstant(at: Date, timeZone: string, lang: Lang): string {
  const local = localTime({ now: at, timeZone });
  return formatTime(local.hour, local.minute, lang);
}
