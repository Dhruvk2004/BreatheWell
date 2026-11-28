import { rowLine } from "@/ai/plan/template";
import { DEMO_FAMILY } from "@/data/demo/family";
import type { DemoQuery } from "@/data/demo/query";
import { storedBreezyFor, storedBreezyKey } from "@/data/demo/storedBreezy";
import type { BreezyCard } from "@/domain/breezy/answer";
import { factById } from "@/domain/impact/facts";
import type { Lang } from "@/domain/time/format";
import { translator, type MessageKey } from "@/i18n/t";
import type { DemoData } from "@/view/demoPage";
import type { BreezyDemoPage, DemoChip } from "@/view/breezy";
import { formatInstant } from "@/domain/time/instant";
import { assembleContext, type BreezyContext } from "../breezy/context";
import { recordedDemo } from "./demoPage";
import { DEMO_PLACE, demoPlanCheck, STORED_PLAN_HOUR } from "./demoPlan";
import { parkAnswer, templeAnswer } from "./demoAnswers";

/**
 * Breezy's demo mode: chips only, no free typing. Each chip shows
 * the stored Gemini answer when one was recorded for this scenario and language, otherwise the
 * code's answer from the rules and the facts library ("Simple answer"). Nothing here calls Gemini.
 */
export const DEMO_CHIPS = ["temple", "riyaPlay", "mask", "park"] as const;
export type DemoChipId = (typeof DEMO_CHIPS)[number];

export const chipKey = (id: DemoChipId): MessageKey => `breezy.demo.chip.${id}`;

interface CodeAnswer {
  readonly text: string;
  readonly cards: readonly BreezyCard[];
}

function riyaAnswer(data: DemoData, lang: Lang): CodeAnswer {
  const row = data.day.rows.find((r) => r.person.id === "riya");
  const play = row?.items.find((i) => i.activity.type === "play");
  if (!row || !play) return { text: translator(lang)("breezy.basicsNone"), cards: [] };
  const line = rowLine({ type: "play", usual: play.activity.usual, mainMode: row.person.travel.main, plan: play.plan }, lang);
  return { text: translator(lang)("breezy.demo.riya", { line }), cards: [] };
}

function codeAnswer(id: DemoChipId, data: DemoData, lang: Lang): CodeAnswer {
  if (id === "temple") return templeAnswer(data, lang);
  if (id === "riyaPlay") return riyaAnswer(data, lang);
  if (id === "park") return parkAnswer(data, lang);
  return { text: factById("n95_fit")?.text[lang] ?? "", cards: [] };
}

/** The demo chips for a scenario in a language: stored words where recorded, the code's otherwise. */
export function demoChips(query: DemoQuery, data: DemoData, lang: Lang): DemoChip[] {
  const t = translator(lang);
  return DEMO_CHIPS.map((id) => {
    const stored = data.source === "recorded" ? storedBreezyFor(storedBreezyKey(query.scenario, id, lang)) : null;
    const answer = stored ?? codeAnswer(id, data, lang);
    return { id, question: t(chipKey(id)), text: answer.text, cards: answer.cards, source: stored ? "gemini" : "template" };
  });
}

/** The demo family's Breezy context, exactly as a real family's (used by the recorder script). */
export function demoBreezyContext(data: DemoData, lang: Lang): BreezyContext | null {
  const plan = demoPlanCheck(data.day, data.weather);
  if (!plan) return null;
  const personOf = (id: string) => DEMO_FAMILY.find((p) => p.id === id);
  return assembleContext({
    plan,
    day: data.day,
    region: "igp",
    namesOf: (id) => {
      const person = personOf(id);
      return person ? [person.name.en, person.name.hi] : [];
    },
    isDependent: (id) => personOf(id)?.kind === "dependent",
    viewerId: "neha",
    lang,
  });
}

/** The public Breezy demo page: a recorded scenario at its 6 am stored-plan time (Live today has no stored answers). */
export function loadBreezyDemo(query: DemoQuery, lang: Lang): BreezyDemoPage {
  const scenario = query.scenario === "live" ? "smog-morning" : query.scenario;
  const data = recordedDemo(scenario, STORED_PLAN_HOUR, "neha");
  return {
    lang,
    people: DEMO_FAMILY.map((p) => ({ id: p.id, name: p.name[lang], kind: p.kind })),
    place: DEMO_PLACE,
    updated: formatInstant(data.clock.now, data.clock.timeZone, lang),
    chips: demoChips({ ...query, scenario }, data, lang),
  };
}
