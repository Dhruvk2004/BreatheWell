import { alternativeById } from "@/domain/libraries/alternatives";
import { ruleFactsOf, type FieldContext, type Tally } from "./fields";
import type { PlanRequest } from "./input";
import { isDependentToken } from "./tokens";
import { MAX_ITEMS, type PlanInputPerson, type PlanOutputItem, type PlanOutputMember, type PlanText } from "./schema";

/** Gemini's words for one activity or swap, after every check passed. */
export interface ValidWords {
  readonly doThis: PlanText;
  readonly why?: PlanText;
  readonly factId?: string;
}

/** One person's valid words, by real activity id. */
export interface ValidPerson {
  readonly line: PlanText | null;
  readonly items: Readonly<Record<string, ValidWords>>;
  readonly swap: (ValidWords & { readonly altId: string }) | null;
}

/** An item's words when its ids exist, its kind is the rule's suggestion and every text passes. */
function checkItem(
  item: PlanOutputItem,
  person: PlanInputPerson,
  request: PlanRequest,
  ctx: FieldContext,
  tally: Tally,
): ValidWords | null {
  const activity = person.activities.find((a) => a.id === item.activityId);
  if (!activity) return tally.fail("unknown_activity");
  if (item.kind !== activity.rule.suggestion) return tally.fail("kind_mismatch");
  if (item.factId && !request.input.allowedFacts.includes(item.factId)) return tally.fail("unknown_fact");
  const forDependent = isDependentToken(person.id);
  const doThis = tally.field(item.doThis, { cap: "doThis", forDependent, rule: ruleFactsOf(activity) }, ctx);
  if (!doThis) return null;
  const why = item.why && tally.field(item.why, { cap: "why", forDependent }, ctx);
  return { doThis, ...(why ? { why } : {}), ...(item.factId ? { factId: item.factId } : {}) };
}

function checkSwap(member: PlanOutputMember, person: PlanInputPerson, ctx: FieldContext, tally: Tally): ValidPerson["swap"] {
  const { swap } = member;
  if (!swap) return null;
  if (!person.alternatives.includes(swap.altId)) return tally.fail("unknown_alternative");
  const forDependent = isDependentToken(person.id);
  const doThis = tally.field(swap.doThis, { cap: "doThis", forDependent }, ctx);
  const why = doThis && swap.why ? tally.field(swap.why, { cap: "why", forDependent }, ctx) : null;
  // The Swap card's "Why?" is the alternative's own fact, so a passing `why` is stored under it.
  const factId = alternativeById(swap.altId)?.factId;
  return doThis ? { altId: swap.altId, doThis, ...(why && factId ? { why, factId } : {}) } : null;
}

/**
 * Checks one person's section: the row line must agree with the activity the row shows, each item
 * with its own rule; anything that fails is left out, so that line or item keeps its template.
 */
export function checkMember(
  member: PlanOutputMember,
  person: PlanInputPerson,
  request: PlanRequest,
  ctx: FieldContext,
  tally: Tally,
): ValidPerson {
  const forDependent = isDependentToken(person.id);
  const headline = person.activities.find((a) => a.id === request.tokens.headline[person.id]);
  const line = tally.field(member.line, { cap: "rowLine", forDependent, ...(headline ? { rule: ruleFactsOf(headline) } : {}) }, ctx);
  const items: Record<string, ValidWords> = {};
  for (const item of member.items.slice(0, MAX_ITEMS)) {
    const words = checkItem(item, person, request, ctx, tally);
    const target = request.tokens.activities[item.activityId];
    if (words && target && !(target.activityId in items)) items[target.activityId] = words;
  }
  return { line, items, swap: checkSwap(member, person, ctx, tally) };
}
