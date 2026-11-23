import type { HomeSetup } from "@/domain/libraries/homeSetup";
import { translator, type Lang, type MessageKey } from "@/i18n/t";

/**
 * The home set-up questions and their read-only summary. Not a client module, so the server-rendered
 * family settings page can call `homeSetupSummary` (stage 8 QA8-1: calling it through the client
 * component crashed the page for every non-admin member).
 */

/** A home nobody has answered: the careful defaults the plan also assumes (no purifier, not sure). */
export const BLANK_HOME: HomeSetup = {
  purifier: "none",
  freshAirVent: false,
  roadFacing: "not_sure",
  fuel: "lpg",
  incense: "never",
  indoorSmoking: "prefer_not",
};

export type Answer = string;
const YES_NO: readonly [Answer, MessageKey][] = [
  ["yes", "common.yes"],
  ["no", "common.no"],
];

/** The six questions (spec 6.3): label, why it changes the advice, and the answers. */
export const QUESTIONS: readonly { key: keyof HomeSetup; label: MessageKey; why: MessageKey; answers: readonly [Answer, MessageKey][] }[] =
  [
    {
      key: "purifier",
      label: "home.purifier",
      why: "home.purifierWhy",
      answers: [
        ["none", "purifier.none"],
        ["one_room", "purifier.one_room"],
        ["several", "purifier.several"],
      ],
    },
    { key: "freshAirVent", label: "home.vent", why: "home.ventWhy", answers: YES_NO },
    { key: "roadFacing", label: "home.road", why: "home.roadWhy", answers: [...YES_NO, ["not_sure", "common.notSure"]] },
    {
      key: "fuel",
      label: "home.fuel",
      why: "home.fuelWhy",
      answers: [
        ["lpg", "fuel.lpg"],
        ["electric", "fuel.electric"],
        ["solid", "fuel.solid"],
      ],
    },
    {
      key: "incense",
      label: "home.incense",
      why: "home.incenseWhy",
      answers: [
        ["daily", "incense.daily"],
        ["sometimes", "incense.sometimes"],
        ["never", "incense.never"],
      ],
    },
    { key: "indoorSmoking", label: "home.smoking", why: "home.smokingWhy", answers: [...YES_NO, ["prefer_not", "smoking.prefer_not"]] },
  ];

/** The stored value as a radio value ("yes"/"no" for the vent), and back. */
export const asAnswer = (home: HomeSetup, key: keyof HomeSetup): Answer =>
  key === "freshAirVent" ? (home.freshAirVent ? "yes" : "no") : String(home[key]);
export const fromAnswer = (key: keyof HomeSetup, answer: Answer): Partial<HomeSetup> =>
  key === "freshAirVent" ? { freshAirVent: answer === "yes" } : ({ [key]: answer } as Partial<HomeSetup>);

/** "Air purifier: In one room · Windows face a busy road: Yes · …" for the read-only family page. */
export function homeSetupSummary(home: HomeSetup, lang: Lang): string {
  const t = translator(lang);
  return QUESTIONS.map((q) => {
    const answer = q.answers.find(([v]) => v === asAnswer(home, q.key));
    return `${t(q.label)}: ${answer ? t(answer[1]) : ""}`;
  }).join(" · ");
}
