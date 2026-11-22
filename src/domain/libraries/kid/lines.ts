import type { Lang } from "../../time/format";

/** Kid card tone: kid for Under 13, a short teen tone for 13–17 (spec 7.2). */
export type Tone = "kid" | "teen";
/** How the kid library groups activities. */
export type KidActivity = "travel" | "play" | "cycling" | "sport";
/** The line variants: the rule's suggestion, plus the Severe-day essential trip. */
export type KidLineKind = "as_planned" | "protect" | "move_time" | "switch_mode" | "switch_severe" | "protect_essential" | "indoor";

type Table = Readonly<Record<KidLineKind, Readonly<Record<KidActivity, string>>>>;

const same = (text: string): Record<KidActivity, string> => ({ travel: text, play: text, cycling: text, sport: text });

/**
 * Kid-tone lines, ≤ 12 words, no numbers (code fills `{time}` and `{when}` from the rule's
 * best time). Slots: {time}, {when}, {mode}, {from}.
 */
const KID_EN: Table = {
  as_planned: {
    travel: "Go as usual. Have a good day!",
    play: "Go and have fun!",
    cycling: "Go and enjoy the ride!",
    sport: "Go and have a great game!",
  },
  protect: {
    travel: "Go as usual and take it easy.",
    play: "Play gently, take breaks and carry water.",
    cycling: "Ride slowly and carry water.",
    sport: "Play easy today and carry water.",
  },
  move_time: {
    travel: "Go at {time} today.",
    play: "Play outside at {time} today.",
    cycling: "Cycle at {time} today.",
    sport: "Play at {time} today.",
  },
  switch_mode: same("Take the {mode} today."),
  switch_severe: same("Only if it's open. Go by {mode}, windows shut."),
  protect_essential: same("Go the shortest way and wear your mask."),
  indoor: {
    travel: "Stay home today. {when}",
    play: "Inside today. {when}",
    cycling: "No cycling today. {when}",
    sport: "Inside games today. {when}",
  },
};

const TEEN_EN: Table = {
  as_planned: same("Good to go today."),
  protect: same("Okay today. Take it easy and carry water."),
  move_time: same("{time} is better. Take it easy."),
  switch_mode: same("{mode} today, not the {from}."),
  switch_severe: same("Only if it's open. {mode}, windows shut."),
  protect_essential: same("Shortest way, mask on."),
  indoor: same("Skip it outside today. {when}"),
};

const KID_HI: Table = {
  as_planned: {
    travel: "रोज़ की तरह जाओ। दिन अच्छा बीते!",
    play: "जाओ, मज़े से खेलो!",
    cycling: "जाओ, मज़े से साइकिल चलाओ!",
    sport: "जाओ, बढ़िया खेलो!",
  },
  protect: {
    travel: "रोज़ की तरह जाओ, आराम से।",
    play: "धीरे खेलो, बीच में आराम करो और पानी साथ रखो।",
    cycling: "धीरे चलाओ और पानी साथ रखो।",
    sport: "आज हल्का खेलो और पानी साथ रखो।",
  },
  move_time: { travel: "आज {time} जाओ।", play: "आज {time} बाहर खेलो।", cycling: "आज {time} साइकिल चलाओ।", sport: "आज {time} खेलो।" },
  switch_mode: same("आज {mode} से जाओ।"),
  switch_severe: same("खुला हो तभी। {mode} से जाओ, खिड़की बंद।"),
  protect_essential: same("सबसे छोटे रास्ते से जाओ और मास्क पहनो।"),
  indoor: {
    travel: "आज घर पर रहो। {when}",
    play: "आज अंदर खेलो। {when}",
    cycling: "आज साइकिल नहीं। {when}",
    sport: "आज अंदर वाले खेल। {when}",
  },
};

const TEEN_HI: Table = {
  as_planned: same("आज ठीक है, जाओ।"),
  protect: same("ठीक है, पर आराम से और पानी साथ रखो।"),
  move_time: same("{time} बेहतर है। आराम से।"),
  switch_mode: same("आज {mode}, {from} नहीं।"),
  switch_severe: same("खुला हो तभी। {mode}, खिड़की बंद।"),
  protect_essential: same("सबसे छोटा रास्ता, मास्क पहनकर।"),
  indoor: same("आज बाहर नहीं। {when}"),
};

const TABLES: Readonly<Record<Tone, Readonly<Record<Lang, Table>>>> = {
  kid: { en: KID_EN, hi: KID_HI },
  teen: { en: TEEN_EN, hi: TEEN_HI },
};

/** The raw line with its slots, for a tone, language, kind and activity. */
export const kidLineTemplate = (tone: Tone, lang: Lang, kind: KidLineKind, activity: KidActivity): string =>
  TABLES[tone][lang][kind][activity];

/** Fills `{slot}` placeholders; an unknown slot becomes empty. */
export function fillSlots(template: string, slots: Readonly<Record<string, string>>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, name: string) => slots[name] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
