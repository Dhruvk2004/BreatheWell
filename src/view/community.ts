import type { Band } from "@/domain/air/bands";
import type { Lang } from "@/domain/time/format";

/**
 * The community message page (spec 10.13): the place and band header from code, the message in
 * English and in Hindi, and where its words came from. Never a cigarette comparison.
 */
export interface ShownMessage {
  /** Gemini's title; null for the template. */
  readonly title: string | null;
  /** Code: "Air in Green Park today: Very poor (24-h average ≈ 341) · Best time outside 2–4 pm". */
  readonly header: string;
  readonly body: string;
  /** "Together today: …" (the label is code). */
  readonly together: string;
  /** Code: "Open-Meteo model data, 7:00 am · Shared via BreatheWell". */
  readonly footer: string;
}

export type CommunityPage =
  | { readonly kind: "no_place" | "rate_limited" }
  | { readonly kind: "unavailable"; readonly place: string }
  | {
      readonly kind: "ready";
      readonly place: string;
      readonly band: Band;
      readonly avg24: number;
      readonly messages: Readonly<Record<Lang, ShownMessage>>;
      readonly source: "gemini" | "template";
    };
