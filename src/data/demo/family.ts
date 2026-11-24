import { dependentActivities, dependentTravel } from "@/domain/dependents/defaults";
import type { FamilyPerson } from "@/domain/family/people";
import type { SwapTick } from "@/domain/impact/emissions";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import type { Lang } from "@/domain/time/format";

/**
 * The Sharma family: the public demo's sample family in Green Park, Delhi. Names and
 * display details live here, apart from the name-free `FamilyPerson` the rules plan for.
 */
export interface DemoPerson extends FamilyPerson {
  readonly name: Readonly<Record<Lang, string>>;
  readonly initials: string;
  readonly admin: boolean;
  /** The person's own language (Dadaji reads Hindi). */
  readonly lang: Lang;
}

const neha: DemoPerson = {
  id: "neha",
  kind: "adult",
  name: { en: "Neha", hi: "नेहा" },
  initials: "NS",
  admin: true,
  lang: "en",
  ageGroup: "18to59",
  conditions: ["none"],
  activities: [{ id: "office", type: "office_trip", usual: "08:30", flex: "fixed", duration: "15to60" }],
  travel: { main: "two_wheeler", tripLength: "15to45", others: ["metro"] },
};

const rahul: DemoPerson = {
  id: "rahul",
  kind: "adult",
  name: { en: "Rahul", hi: "राहुल" },
  initials: "RS",
  admin: false,
  lang: "en",
  ageGroup: "18to59",
  conditions: ["none"],
  activities: [{ id: "office", type: "office_trip", usual: "09:00", flex: "fixed", duration: "15to60" }],
  travel: { main: "car", tripLength: "15to45", others: ["metro", "carpool"] },
};

const dadaji: DemoPerson = {
  id: "dadaji",
  kind: "adult",
  name: { en: "Dadaji", hi: "दादाजी" },
  initials: "DJ",
  admin: false,
  lang: "hi",
  ageGroup: "60plus",
  conditions: ["asthma"],
  activities: [{ id: "walk", type: "morning_walk", usual: "06:30", flex: "any", duration: "15to60" }],
  travel: { main: "walk", tripLength: "under15", others: [] },
};

const aarav: DemoPerson = {
  id: "aarav",
  kind: "dependent",
  name: { en: "Aarav", hi: "आरव" },
  initials: "A",
  admin: false,
  lang: "en",
  ageGroup: "13to17",
  conditions: ["none"],
  activities: dependentActivities([{ choice: "sport" }, { choice: "tuition" }]),
  travel: dependentTravel("cycle"),
};

const riya: DemoPerson = {
  id: "riya",
  kind: "dependent",
  name: { en: "Riya", hi: "रिया" },
  initials: "R",
  admin: false,
  lang: "en",
  ageGroup: "under13",
  conditions: ["none"],
  activities: dependentActivities([{ choice: "school_trip" }, { choice: "play" }]),
  travel: dependentTravel("cycle"),
};

/** Neha (admin), Rahul, Dadaji, and the two dependents Neha added. */
export const DEMO_FAMILY: readonly DemoPerson[] = [neha, rahul, dadaji, aarav, riya];

/** The two "View as" people. */
export const DEMO_VIEWERS = ["neha", "dadaji"] as const;
export type DemoViewer = (typeof DEMO_VIEWERS)[number];

/** The Sharma home set-up: a purifier in Dadaji's room, a busy road, incense sometimes. */
export const DEMO_HOME: HomeSetup = {
  purifier: "one_room",
  freshAirVent: false,
  roadFacing: "yes",
  fuel: "lpg",
  incense: "sometimes",
  indoorSmoking: "no",
};

/** The sample family's ticked swaps this week (Rahul and Neha took the metro three days each). */
export const DEMO_WEEK_TICKS: readonly SwapTick[] = [
  ...Array.from({ length: 3 }, () => ({ from: "car", to: "metro", tripLength: "15to45" }) as const),
  ...Array.from({ length: 3 }, () => ({ from: "two_wheeler", to: "metro", tripLength: "15to45" }) as const),
];

/** A demo person by id. */
export const demoPerson = (id: string): DemoPerson | undefined => DEMO_FAMILY.find((p) => p.id === id);
