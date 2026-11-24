import type { DemoPerson } from "@/data/demo/family";
import type { DemoQuery } from "@/data/demo/query";
import type { HourlyAir } from "@/domain/air/hourly";
import type { Band } from "@/domain/air/bands";
import type { HourlyWeather } from "@/domain/air/weatherWhy";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { PersonPlan } from "@/domain/family/people";
import type { KidCard } from "@/domain/libraries/kid";
import type { Clock } from "@/domain/time/clock";
import type { Lang } from "@/domain/time/format";
import type { PlanWords } from "./app";

/** Where the demo's air came from: a recorded day, live Open-Meteo, or the saved 20 Nov snapshot. */
export type DemoSource = "recorded" | "live" | "fallback";

/** What the demo page renders: the query, the air and the Sharma family's planned day. */
export interface DemoData {
  readonly query: DemoQuery;
  readonly source: DemoSource;
  /** The recorded day ("2024-11-18"), for "Recorded sample day: Delhi, {date}". */
  readonly recordedDate: string | null;
  readonly air: HourlyAir;
  readonly weather: HourlyWeather;
  readonly clock: Clock;
  readonly day: FamilyDay;
  /** The stored 6 am Gemini plan's words in each language (template-only when none is stored). */
  readonly words: Readonly<Record<Lang, PlanWords>>;
  /** A stored plan exists for this scenario (12 pm and 4 pm say it was written for 6 am). */
  readonly storedPlan: boolean;
}

/** A demo dependent's kid card: public, from fixtures, text only from the kid library. */
export interface KidPage {
  readonly data: DemoData;
  readonly person: DemoPerson;
  readonly plan: PersonPlan;
  readonly band: Band;
  readonly card: KidCard;
  readonly shareText: string;
}
