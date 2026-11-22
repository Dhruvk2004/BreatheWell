import { bandRank, type Band } from "../air/bands";
import type { Bilingual } from "../impact/facts";
import type { ActivityType, TripLength } from "../rules/activities";
import type { Mode } from "../rules/modes";
import type { HomeSetup } from "./homeSetup";
import { ALTERNATIVES } from "./alternativesData";

/**
 * A low-emission alternative (spec 7.5). Travel swaps carry `from` and `to`, so their "for the air"
 * figure is computed by `avoidedBySwap`; home and community actions have fixed wording.
 */
export interface Alternative {
  readonly id: string;
  /** The usual modes this swap replaces (travel swaps only). */
  readonly from?: readonly Mode[];
  /** The mode it switches to; the person must have it among their options. */
  readonly to?: Mode;
  /** Needs one of these activities in the routine. */
  readonly activities?: readonly ActivityType[];
  /** Only for these trip lengths (no cycling 15 km). */
  readonly tripLengths?: readonly TripLength[];
  /** Only when the day's best window is this band or better (e.g. cycling in clean hours). */
  readonly bestBandMax?: Band;
  /** Only on a Severe day. */
  readonly severeOnly?: boolean;
  /** Only when the home set-up matches. */
  readonly home?: (home: HomeSetup) => boolean;
  readonly doThis: Bilingual;
  readonly forYou: Bilingual;
  readonly forAir: Bilingual;
  readonly factId: string;
}

/** What code knows about a person and the day when it filters alternatives. */
export interface AlternativeContext {
  readonly main: Mode;
  /** Modes the person can use (their "other options"; metro only where the city has one). */
  readonly options: readonly Mode[];
  readonly tripLength: TripLength;
  readonly activities: readonly ActivityType[];
  readonly home: HomeSetup | null;
  readonly bestBand: Band;
  readonly severeDay: boolean;
}

function fits(alt: Alternative, ctx: AlternativeContext): boolean {
  if (alt.from && !alt.from.includes(ctx.main)) return false;
  if (alt.to && !ctx.options.includes(alt.to)) return false;
  if (alt.activities && !alt.activities.some((a) => ctx.activities.includes(a))) return false;
  if (alt.tripLengths && !alt.tripLengths.includes(ctx.tripLength)) return false;
  if (alt.bestBandMax && bandRank(ctx.bestBand) > bandRank(alt.bestBandMax)) return false;
  if (alt.severeOnly && !ctx.severeDay) return false;
  return !alt.home || (ctx.home !== null && alt.home(ctx.home));
}

/**
 * The alternatives code allows for one person today (spec 7.5): Gemini picks one of these and
 * explains it; if none fits there is no swap card (never forced).
 */
export function eligibleAlternatives(ctx: AlternativeContext): Alternative[] {
  return ALTERNATIVES.filter((alt) => fits(alt, ctx));
}

/** An alternative by id. */
export const alternativeById = (id: string): Alternative | undefined => ALTERNATIVES.find((a) => a.id === id);

/** Community "together" actions (spec 7.6): eligible for every area, chosen by code. */
export const COMMUNITY_ACTIONS = [
  "no_leaf_burning",
  "no_garbage_burning",
  "carpool_school_run",
  "no_idling_gate",
  "wet_sweep_roads",
  "report_burning",
] as const;
export type CommunityAction = (typeof COMMUNITY_ACTIONS)[number];
