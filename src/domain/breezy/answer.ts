import { z } from "zod";
import { LANGS } from "../time/format";
import { BREEZY_ACTIVITIES } from "./activity";
import { MAX_HISTORY, MAX_QUESTION } from "./question";

/**
 * The Breezy API's shapes (spec 7.7), shared by the route handlers and the browser: the question
 * body, the answer kinds, a suggestion card as the page shows it, and the confirmed action body.
 * The verdict on a card always comes from the rules on the server.
 */
const verdict = z.enum(["go", "care", "avoid"]);
const bilingual = z.object({ en: z.string().max(200), hi: z.string().max(200) });

/** "HH:00" or "HH:30" between 06:00 and 21:00. */
export const cardTime = z.string().regex(/^(?:0[6-9]|1\d|2[01]):(?:00|30)$/u);

const slot = z.object({ time: cardTime, verdict }).nullable();

/** "Picture it" from code (spec 7.7.3): only on an adult's card with an activity and a time. */
const picture = z.object({
  lessPercent: z.number().int().min(0).max(100),
  thanTime: cardTime,
  dayOutside: z.object({ count: z.number().int().min(1), lessThanOne: z.boolean() }),
});

export const breezyCard = z.object({
  title: z.string(),
  /** Member uid or dependent id; null asks "Who is this for?". */
  forId: z.string().nullable(),
  date: z.enum(["today", "tomorrow"]),
  time: cardTime.nullable(),
  activity: z.enum(BREEZY_ACTIVITIES).nullable(),
  /** From the rules; null for a card without an activity and time. */
  verdict: verdict.nullable(),
  why: z.string(),
  factId: z.string().nullable(),
  action: z.enum(["add_to_plan", "add_checklist", "share"]),
  item: bilingual,
  /** A dependent's item that fails the kid-card checks shows on the parent's view only. */
  onCard: z.boolean(),
  /** For a card with no person: each person's rule slot (null = Avoid all day, cannot be added). */
  slots: z.record(z.string(), slot).optional(),
  picture: picture.optional(),
});
export type BreezyCard = z.infer<typeof breezyCard>;

/** Why Breezy declined (spec 7.7.5): `admin_action` links to Family settings for the admin. */
export const REFUSALS = ["medical", "off_topic", "admin_action", "other"] as const;
export type Refusal = (typeof REFUSALS)[number];

export const breezyAnswer = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("reply"),
    text: z.string(),
    lang: z.enum(LANGS),
    cards: z.array(breezyCard).max(3),
    refusal: z.enum(REFUSALS).nullable().default(null),
  }),
  z.object({ kind: z.literal("ask_alias"), kin: z.string(), word: z.string() }),
  z.object({ kind: z.literal("emergency") }),
  z.object({ kind: z.literal("basics") }),
  z.object({ kind: z.literal("quota") }),
]);
export type BreezyAnswer = z.infer<typeof breezyAnswer>;

const turn = z.object({ role: z.enum(["user", "breezy"]), text: z.string().max(1_000) });

/** `POST /api/breezy`: the raw question (cut to 300 on the server) and the client-held history. */
export const askBody = z.strictObject({
  question: z
    .string()
    .trim()
    .min(1)
    .max(MAX_QUESTION * 2),
  history: z.array(turn).max(8).default([]),
});

/** `POST /api/breezy/action`: what the confirm sheet sends; the server checks all of it again. */
export const actionBody = z.strictObject({
  type: z.enum(["add_to_plan", "add_checklist"]),
  forId: z.string().min(1).max(128),
  date: z.enum(["today", "tomorrow"]),
  time: cardTime.nullable(),
  activity: z.enum(BREEZY_ACTIVITIES).nullable(),
  item: bilingual,
  factId: z.string().max(40).nullable().default(null),
});
export type ActionBody = z.infer<typeof actionBody>;

export const actionAnswer = z.object({
  ok: z.literal(true),
  onCard: z.boolean(),
  /** A member's item: the `wa.me` text (item text and names only); null for a dependent or yourself. */
  whatsapp: z.string().nullable(),
});

/** `PUT /api/aliases`: "papa" → the member or dependent the viewer means (spec 7.7.9). */
export const aliasBody = z.strictObject({ key: z.string().trim().min(1).max(20), forId: z.string().min(1).max(128) });

export { MAX_HISTORY };
