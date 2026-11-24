import type { BreezyCard } from "@/domain/breezy/answer";
import type { Verdict } from "@/domain/rules/verdict";
import type { Lang } from "@/domain/time/format";

/**
 * The Breezy page: who can be picked, the code basics for the fallback, and the header
 * line "Breezy uses today's air for {place}, {time}". Demo mode adds the stored chip answers.
 */
export interface BreezyPerson {
  readonly id: string;
  readonly name: string;
  readonly kind: "adult" | "dependent";
}

export interface BasicsView {
  readonly id: string;
  readonly name: string;
  readonly verdict: Verdict;
  readonly line: string;
}

export interface BreezyPage {
  readonly viewerId: string;
  readonly viewerName: string;
  /** The family admin: an `admin_action` refusal links to Family settings. */
  readonly isAdmin: boolean;
  readonly lang: Lang;
  readonly place: string;
  /** "7:00 am": the air reading's time, or null without air. */
  readonly updated: string | null;
  readonly people: readonly BreezyPerson[];
  readonly basics: readonly BasicsView[];
  /** False without Gemini configured: questions get the basics at once. */
  readonly configured: boolean;
}

/** One demo chip: the question, and the answer (stored Gemini words, or the code's Simple answer). */
export interface DemoChip {
  readonly id: string;
  readonly question: string;
  readonly text: string;
  readonly cards: readonly BreezyCard[];
  readonly source: "gemini" | "template";
}

export interface BreezyDemoPage {
  readonly lang: Lang;
  readonly people: readonly BreezyPerson[];
  readonly place: string;
  readonly updated: string;
  readonly chips: readonly DemoChip[];
}
