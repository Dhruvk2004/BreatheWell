import type { Band } from "@/domain/air/bands";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { PersonPlan } from "@/domain/family/people";
import type { DependentInput } from "@/domain/dependents/schema";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import type { KidCard } from "@/domain/libraries/kid";
import type { ProfileInput } from "@/domain/members/profile";
import type { NamedCondition } from "@/domain/rules/conditionTicks";
import type { AgeGroup, CareTag } from "@/domain/rules/groups";
import type { Mode } from "@/domain/rules/modes";
import type { Verdict } from "@/domain/rules/verdict";
import type { Lang } from "@/domain/time/format";

/**
 * View models of the signed-in pages (spec 10.4–10.15): plain types the server loaders build and
 * the components render. Names appear only here and on screen, never in anything sent to Gemini.
 */
export interface PersonView {
  /** Member uid or dependent id (random, never derived from a name). */
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly kind: "adult" | "dependent";
  readonly ageGroup: AgeGroup;
  readonly careTag: CareTag;
  readonly admin: boolean;
  readonly onboarded: boolean;
  readonly mainMode: Mode;
  readonly language: Lang;
  /** Dependents: the adult who added them. */
  readonly guardianUid: string | null;
  readonly guardianName: string | null;
  /** Members who joined with a code: when (ISO). */
  readonly joinedAt: string | null;
}

export interface FamilyView {
  readonly id: string;
  readonly name: string;
  readonly placeName: string;
  readonly viewerUid: string;
  readonly isAdmin: boolean;
  /** Members first (in join order), then dependents. */
  readonly people: readonly PersonView[];
}

/** The family's air and the rules' day, or null pieces when the air is missing (spec 8.5). */
export interface AirView {
  readonly day: FamilyDay | null;
  readonly fetchedAt: string | null;
  readonly timeZone: string;
  readonly stationNote: boolean;
  /** The chip for members still setting up: Sensitive group, moderate activity, now (spec 5.11). */
  readonly setupVerdict: Verdict | null;
}

/** Gemini's words for one item, tip or swap, in the page language with names filled in. */
export interface Words {
  readonly doThis: string;
  readonly why?: string;
  /** The fact `why` explains: a page shows `why` only inside that fact's "Why?" panel. */
  readonly factId?: string;
}

/**
 * The plan's words on a page (spec 7.2, design G `PlanSourceLine`): Gemini's where they are still
 * valid, keyed by person and activity id; anything missing shows its template text.
 */
export interface PlanWords {
  /** "gemini" only while some Gemini words are on screen. */
  readonly source: "gemini" | "template";
  /** When the stored plan was written (ISO). */
  readonly generatedAt: string | null;
  /** No current plan yet today: the client asks `POST /api/plan` and shows the badge meanwhile. */
  readonly pending: boolean;
  /** 3 generations used today and the family changed since: new details use the simple plan. */
  readonly capped: boolean;
  /** Today's plan is a Simple plan and another generation is allowed: show Try again. */
  readonly canRetry: boolean;
  readonly rows: Readonly<Record<string, string>>;
  readonly items: Readonly<Record<string, Readonly<Record<string, Words>>>>;
  readonly swaps: Readonly<Record<string, Words & { readonly altId: string }>>;
  readonly home: Readonly<Record<string, Words>>;
  readonly together: Words | null;
}

/** "This week your family avoided about 9 kg CO₂ and 6 car trips" (spec 7.5, F21), from `progress`. */
export interface WeekTotals {
  readonly co2Kg: number;
  readonly carTrips: number;
}

export interface TodayPage {
  readonly family: FamilyView;
  readonly air: AirView;
  /** Admin only: members who joined with a code in the last day ("Rahul joined via your code"). */
  readonly joinCards: readonly { readonly uid: string; readonly name: string; readonly at: string }[];
  readonly words: PlanWords;
  readonly week: WeekTotals;
  /** The bilingual "Share today's plan" text (F23): code text only, no health tags or cigarettes. */
  readonly shareText: string | null;
  /** The community message for the family's home area (spec 10.13, "in the app"). */
  readonly communityHref: string;
}

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly addedByName: string;
  readonly done: boolean;
  /** Dependents only: false when the text fails the kid-card checks (parent's view only, spec 7.7.6). */
  readonly onCard: boolean;
}

/** The member plan's Swap card: an alternative code allowed, with Gemini's words when they passed. */
export interface PlanSwapView {
  readonly altId: string;
  readonly words: Words | null;
}

export interface MemberPage {
  readonly family: FamilyView;
  readonly person: PersonView;
  readonly plan: PersonPlan | null;
  readonly air: AirView;
  readonly checklist: readonly ChecklistItem[];
  /** Today's ticked plan keys (activity ids). */
  readonly ticked: readonly string[];
  readonly canEdit: boolean;
  /** Health condition names this viewer may see (spec 6.4): shared ones only; empty otherwise. */
  readonly conditions: readonly NamedCondition[];
  readonly words: PlanWords;
  readonly swap: PlanSwapView | null;
}

/** What a kid card shows (spec 10.12), for the demo and for a family's dependent. */
export interface KidCardData {
  readonly name: string;
  readonly band: Band;
  readonly card: KidCard;
  readonly plan: PersonPlan;
  readonly shareText: string;
  readonly checklist?: readonly ChecklistItem[];
  /** A family's card (not the demo): who the ticks are for and today's ticked plan keys (spec 5.5 step 7). */
  readonly ticks?: { readonly forId: string; readonly done: readonly string[] };
}

export interface KidCardPage {
  readonly kid: KidCardData | null;
  readonly person: PersonView;
  readonly lang: Lang;
}

export interface InvitePage {
  readonly familyName: string;
  readonly code: string | null;
  readonly expiresAt: string | null;
  readonly joinUrl: string | null;
}

/** `/join/[code]` before sign-in: the family name only after the server checks the code (spec 5.4). */
export type InvitePreview =
  | { readonly kind: "valid"; readonly code: string; readonly familyName: string; readonly adminName: string; readonly expiresAt: string }
  | { readonly kind: "expired"; readonly adminName: string }
  | { readonly kind: "not_found" | "rate_limited" | "not_configured" };

export interface SettingsPage {
  readonly family: FamilyView;
  readonly homeSetup: HomeSetup | null;
}

export interface ProfilePage {
  readonly input: ProfileInput;
  readonly familyName: string | null;
  readonly isAdmin: boolean;
  /** An admin with other members cannot leave or delete the account (spec 5.10). */
  readonly mustStay: boolean;
  readonly dependents: readonly { readonly id: string; readonly name: string }[];
}

export interface DependentPage {
  readonly familyName: string;
  readonly guardianName: string;
  /** Null for a new dependent. */
  readonly id: string | null;
  readonly input: DependentInput | null;
  readonly canDelete: boolean;
}

/** Onboarding's starting point (spec 10.5). */
export interface OnboardingPage {
  readonly googleName: string;
  readonly input: ProfileInput | null;
  readonly hasFamily: boolean;
  readonly familyName: string | null;
  readonly removedFrom: string | null;
}
