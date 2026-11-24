import { breezyCheck } from "@/ai/breezy/input";
import type { BreezyCheck } from "@/ai/breezy/validate";
import type { PlanCheck } from "@/ai/plan/validate";
import type { NamedPerson } from "@/domain/breezy/names";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { Region, RuleContext } from "@/domain/rules/context";
import type { Lang } from "@/domain/time/format";
import type { FamilyPlanDay } from "../app/familyPlan";
import type { FamilyBundle } from "../repos/family";
import { namesById, planCheckFor } from "../plan/context";
import { hourAllowedFor, ruleContextOf } from "./slot";

/**
 * Everything one Breezy question needs on the server: the pseudonymised check for
 * Gemini, the people behind each token (names stay here), the rules' day to re-check card times.
 */
export interface BreezyContext {
  readonly check: BreezyCheck;
  readonly people: readonly NamedPerson[];
  /** Token → member uid or dependent id. */
  readonly idOf: Readonly<Record<string, string>>;
  readonly day: FamilyDay;
  readonly ctx: RuleContext;
}

/** What a family's (or the demo family's) Breezy context is made from. */
export interface ContextParts {
  readonly plan: PlanCheck;
  readonly day: FamilyDay;
  readonly region: Region;
  /** Each person's names by id (stored name plus its other-script spellings). */
  readonly namesOf: (id: string) => readonly string[];
  readonly isDependent: (id: string) => boolean;
  readonly viewerId: string;
  readonly lang: Lang;
}

/** Builds the context; the validator gets the rules for every time in Breezy's free text. */
export function assembleContext(parts: ContextParts): BreezyContext {
  const idOf = parts.plan.request.tokens.people;
  const people = Object.entries(idOf).map(([token, id]): NamedPerson => ({
    id,
    token,
    kind: parts.isDependent(id) ? "dependent" : "adult",
    names: parts.namesOf(id),
  }));
  const viewer = people.find((p) => p.id === parts.viewerId)?.token ?? null;
  const { day } = parts;
  const ctx = ruleContextOf(day.summary.date, parts.region);
  const allowed = hourAllowedFor({ day, ctx }, idOf);
  return {
    check: breezyCheck({ plan: parts.plan, summary: day.summary, viewer, viewerLanguage: parts.lang, allowed }),
    people,
    idOf,
    day,
    ctx,
  };
}

/** The context for a viewer, or null without a planned day (no air data, nobody planned). */
export function breezyContext(bundle: FamilyBundle, planned: FamilyPlanDay, viewerUid: string, lang: Lang): BreezyContext | null {
  const plan = planCheckFor(bundle, planned);
  if (!plan || !planned.day || !planned.snapshot) return null;
  const nameOf = namesById(bundle);
  const dependents = new Set(bundle.dependents.map((d) => d.id));
  return assembleContext({
    plan,
    day: planned.day,
    region: planned.region,
    namesOf: (id) => [nameOf[id]],
    isDependent: (id) => dependents.has(id),
    viewerId: viewerUid,
    lang,
  });
}
