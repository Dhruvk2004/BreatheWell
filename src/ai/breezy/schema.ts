import { z } from "zod";
import { BREEZY_ACTIVITIES } from "@/domain/breezy/activity";
import { REFUSALS } from "@/domain/breezy/answer";
import type { DayOutlook } from "@/domain/air/outlook";
import type { Band } from "@/domain/air/bands";
import type { Lang } from "@/domain/time/format";
import { hhmm, LANGS } from "@/domain/time/format";
import type { PlanInput, PlanInputPerson } from "../plan/schema";

/**
 * Breezy's structured output. The schema keeps loose limits so one long field does not
 * void the whole reply; the validator applies the real caps (reply ≤ 400, title ≤ 50, why ≤ 140)
 * field by field and drops a failing card on its own.
 */
export const MAX_CARDS = 3;
export const ACTION_TYPES = ["add_to_plan", "add_checklist", "share"] as const;

const loose = (max: number) => z.string().max(max);

const card = z.object({
  title: loose(120),
  forMemberId: z.string().max(8).nullable(),
  date: z.enum(["today", "tomorrow"]),
  /** "HH:00" or "HH:30" within 06:00–21:00, or null for an untimed checklist item. */
  time: z
    .string()
    .regex(/^(?:0[6-9]|1\d|2[01]):(?:00|30)$/u)
    .nullable(),
  activityType: z.enum(BREEZY_ACTIVITIES).nullable(),
  why: loose(300),
  factId: z.string().max(40).nullable(),
  action: z.enum(ACTION_TYPES),
  /** The text added or shared, in both languages (spec 7.7.4 `text {en,hi}`). */
  item: z.object({ en: loose(200), hi: loose(200) }),
});

export const breezyOutputSchema = z.object({
  reply: z.object({ text: loose(800), lang: z.enum(LANGS) }),
  cards: z.array(card).max(MAX_CARDS + 2),
  refusal: z.enum(REFUSALS).nullable(),
});

export type BreezyOutput = z.infer<typeof breezyOutputSchema>;
export type BreezyOutputCard = BreezyOutput["cards"][number];

/** One outlook day as Breezy sees it: band words and the best window, no numbers. */
export interface OutlookInput {
  readonly date: string;
  readonly worstBand: Band;
  readonly bestWindow: string | null;
}

/** The pseudonymised context: the plan input's people and air, plus the outlook. */
export interface BreezyInput {
  /** The viewer's token, or null for a member still setting up. */
  readonly viewer: string | null;
  readonly viewerLanguage: Lang;
  readonly date: string;
  readonly place: string;
  readonly air: PlanInput["air"];
  readonly todayBands: readonly (Band | null)[];
  readonly outlook: readonly OutlookInput[];
  readonly people: readonly PlanInputPerson[];
  readonly home: PlanInput["home"];
  readonly allowedFacts: readonly string[];
}

/** The outlook without numbers: "2026-11-23", worst band, "14:00-16:00". */
export const outlookInput = (days: readonly DayOutlook[]): OutlookInput[] =>
  days.map((d) => ({ date: d.date, worstBand: d.worstBand, bestWindow: d.best ? `${hhmm(d.best.start)}-${hhmm(d.best.end)}` : null }));
