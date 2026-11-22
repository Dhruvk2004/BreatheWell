import type { CommunityMessage } from "@/ai/community/template";
import type { AirNowModel } from "@/domain/public/airNow";

/**
 * View models: what a page renders, as plain types shared by the server loaders that build them and
 * the presentational components that show them. No runtime code lives in `src/view/`.
 */

/** The place line ("Green Park, New Delhi · Change"). */
export interface PlaceView {
  readonly name: string | null;
  /** What the page shows: the name, else "Near 28.56, 77.21" in the page language. */
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
}

/** What the Air now page renders (spec 10.2 and its states). */
export type AirNowPage =
  | { readonly kind: "no_place" }
  | { readonly kind: "rate_limited" }
  | { readonly kind: "unavailable"; readonly place: PlaceView }
  | {
      readonly kind: "ready";
      readonly place: PlaceView;
      readonly model: AirNowModel;
      readonly timeZone: string;
      readonly fetchedAt: Date;
      /** The template community message in the page language, or null without a 24-hour average. */
      readonly community: CommunityMessage | null;
    };
