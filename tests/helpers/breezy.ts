import type { BreezyOutput, BreezyOutputCard } from "@/ai/breezy/schema";
import type { BreezyCheck } from "@/ai/breezy/validate";
import type { Lang } from "@/domain/time/format";
import { demoBreezyContext } from "@/server/demo/demoBreezy";
import { recordedDemo } from "@/server/demo/demoPage";
import type { BreezyContext } from "@/server/breezy/context";

/**
 * Breezy test fixtures: the demo Sharma family on a recorded day (tokens m1 Neha, m2 Rahul,
 * m3 Dadaji, d1 Aarav, d2 Riya), and replies shaped like Gemini's.
 */
export function demoContext(scenario: "smog-morning" | "severe-day" = "smog-morning", lang: Lang = "en"): BreezyContext {
  const ctx = demoBreezyContext(recordedDemo(scenario, 6, "neha"), lang);
  if (!ctx) throw new Error("no demo context");
  return ctx;
}

/** The same check as another viewer (Dadaji is m3). */
export const asViewer = (check: BreezyCheck, viewer: string): BreezyCheck => ({ ...check, input: { ...check.input, viewer } });

export const card = (over: Partial<BreezyOutputCard> = {}): BreezyOutputCard => ({
  title: "Temple visit at 3 pm",
  forMemberId: "m3",
  date: "today",
  time: "15:00",
  activityType: "temple_errand",
  why: "Afternoon sun lifts the smoke.",
  factId: "morning_inversion",
  action: "add_to_plan",
  item: { en: "Temple visit at 3 pm", hi: "दोपहर 3 बजे मंदिर जाएँ" },
  ...over,
});

export const reply = (text: string, cards: BreezyOutputCard[] = [], lang: Lang = "en", refusal: BreezyOutput["refusal"] = null): string =>
  JSON.stringify({ reply: { text, lang }, cards, refusal });
