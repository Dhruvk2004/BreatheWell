import type { RecordedId } from "@/data/recorded/scenarios";
import { dependentActivities, dependentTravel } from "@/domain/dependents/defaults";
import type { FamilyPerson } from "@/domain/family/people";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import type { ActivityType } from "@/domain/rules/activities";
import type { Mode } from "@/domain/rules/modes";
import type { Lang } from "@/domain/time/format";

/**
 * The 10 eval families: made-up people on the recorded Delhi days, covering two
 * dependents sent as tokens, a 60+ Hindi speaker, a 10-person family (6 adults + 4 dependents),
 * a Severe day, Hindi-only and English-only families. Names exist only so the validator can
 * catch a leak; they are never in a prompt.
 */
export interface EvalPerson extends FamilyPerson {
  readonly name: string;
  readonly lang: Lang;
}

export interface EvalFamily {
  readonly id: string;
  readonly scenario: RecordedId;
  readonly people: readonly EvalPerson[];
  readonly home: HomeSetup;
}

const HOME: HomeSetup = {
  purifier: "one_room",
  freshAirVent: false,
  roadFacing: "yes",
  fuel: "lpg",
  incense: "sometimes",
  indoorSmoking: "no",
};
const BASIC_HOME: HomeSetup = {
  purifier: "none",
  freshAirVent: false,
  roadFacing: "not_sure",
  fuel: "solid",
  incense: "daily",
  indoorSmoking: "prefer_not",
};

function adult(name: string, lang: Lang, type: ActivityType, usual: string, main: Mode, more: Partial<EvalPerson> = {}): EvalPerson {
  return {
    id: name.toLowerCase(),
    kind: "adult",
    name,
    lang,
    ageGroup: "18to59",
    conditions: [],
    activities: [{ id: type, type, usual, flex: type.endsWith("walk") ? "any" : "fixed", duration: "15to60" }],
    travel: { main, tripLength: "15to45", others: ["metro"] },
    ...more,
  };
}

function child(
  name: string,
  ageGroup: "under13" | "13to17",
  picks: readonly ("school_trip" | "play" | "tuition" | "sport")[],
  main: Mode,
): EvalPerson {
  return {
    id: name.toLowerCase(),
    kind: "dependent",
    name,
    lang: "en",
    ageGroup,
    conditions: [],
    activities: dependentActivities(picks.map((choice) => ({ choice }))),
    travel: dependentTravel(main),
  };
}

const grandparent = (name: string, lang: Lang, extra: boolean) =>
  adult(name, lang, "morning_walk", "06:30", "walk", { ageGroup: "60plus", conditions: extra ? ["asthma"] : [] });

export const EVAL_FAMILIES: readonly EvalFamily[] = [
  {
    id: "two-dependents",
    scenario: "smog-morning",
    home: HOME,
    people: [
      adult("Kavita", "en", "office_trip", "08:30", "two_wheeler"),
      child("Ishaan", "under13", ["school_trip", "play"], "cycle"),
      child("Meera", "13to17", ["sport"], "walk"),
    ],
  },
  {
    id: "hindi-grandparent",
    scenario: "smog-morning",
    home: HOME,
    people: [grandparent("Shanti", "hi", true), adult("Arjun", "hi", "office_trip", "09:00", "car")],
  },
  {
    id: "ten-people",
    scenario: "smog-morning",
    home: HOME,
    people: [
      adult("Pooja", "en", "office_trip", "08:30", "two_wheeler"),
      adult("Vikram", "en", "office_trip", "09:00", "car"),
      grandparent("Kamla", "hi", true),
      grandparent("Mohan", "hi", false),
      adult("Sunita", "hi", "errands", "17:00", "auto_bus"),
      adult("Rohit", "en", "evening_walk", "19:00", "walk"),
      child("Anaya", "under13", ["school_trip", "play"], "school_bus"),
      child("Kabir", "under13", ["school_trip"], "cycle"),
      child("Tara", "13to17", ["tuition"], "walk"),
      child("Dev", "13to17", ["sport"], "cycle"),
    ],
  },
  {
    id: "severe-day",
    scenario: "severe-day",
    home: HOME,
    people: [
      grandparent("Ramesh", "hi", true),
      adult("Neelam", "en", "office_trip", "08:30", "two_wheeler"),
      child("Aditi", "under13", ["school_trip"], "cycle"),
    ],
  },
  {
    id: "severe-office",
    scenario: "severe-day",
    home: BASIC_HOME,
    people: [adult("Farhan", "en", "office_trip", "09:30", "car"), adult("Zoya", "en", "morning_walk", "07:00", "walk")],
  },
  {
    id: "english-couple",
    scenario: "live-fallback",
    home: HOME,
    people: [adult("Ananya", "en", "office_trip", "08:00", "metro"), adult("Karan", "en", "evening_walk", "18:30", "walk")],
  },
  {
    id: "hindi-only",
    scenario: "live-fallback",
    home: BASIC_HOME,
    people: [adult("Rekha", "hi", "errands", "11:00", "auto_bus"), grandparent("Hari", "hi", false)],
  },
  {
    id: "teen-and-asthma",
    scenario: "smog-morning",
    home: BASIC_HOME,
    people: [
      adult("Simran", "en", "morning_walk", "06:00", "walk", { conditions: ["asthma"] }),
      child("Yash", "13to17", ["school_trip", "sport"], "two_wheeler"),
    ],
  },
  { id: "solo-commuter", scenario: "severe-day", home: HOME, people: [adult("Manish", "en", "office_trip", "08:00", "two_wheeler")] },
  {
    id: "mixed-languages",
    scenario: "live-fallback",
    home: HOME,
    people: [
      adult("Lata", "hi", "morning_walk", "06:30", "walk"),
      adult("Sameer", "en", "office_trip", "09:00", "car"),
      child("Riddhi", "under13", ["play"], "walk"),
    ],
  },
];
