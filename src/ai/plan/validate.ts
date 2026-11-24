import type { ClockTime } from "@/ai/shared/times";
import { parseHhMm } from "@/domain/time/format";
import { Tally, type FieldContext, type FieldSpec } from "./fields";
import type { PlanRequest } from "./input";
import { MAX_HOME_TIPS, planOutputSchema, type PlanInputPerson, type PlanOutput, type PlanText } from "./schema";
import { checkMember, type ValidPerson } from "./validateMember";

/**
 * The family plan validator: Zod structure first, then every field on its own. A
 * field or item that fails is dropped, so it falls back to its template; ids must come from the
 * input; activity items must match the rules (kind and the contradiction checks); a dependent's
 * text must also pass the kid-card checks. Null means the whole reply is unusable.
 */
export type { ValidPerson, ValidWords } from "./validateMember";

export interface ValidPlan {
  /** By real person id (uid or dependent id), never by token. */
  readonly people: Readonly<Record<string, ValidPerson>>;
  readonly home: readonly { readonly tipId: string; readonly doThis: PlanText; readonly why?: PlanText }[];
  readonly together: { readonly altId: string; readonly doThis: PlanText } | null;
  /** Fields that passed and failed, and the failure codes (for the log and the eval). */
  readonly passed: number;
  readonly failed: number;
  readonly reasons: readonly string[];
}

export interface PlanCheck {
  readonly request: PlanRequest;
  /** Every member's and dependent's name and alias. */
  readonly names: readonly string[];
  /** Token → the person's name, to measure lines as shown. */
  readonly nameOf: Readonly<Record<string, string>>;
}

/** Every time the input names: usual and best times, and the window ends (spec 7.1 allowlist). */
export function allowedTimes(request: PlanRequest): ClockTime[] {
  const { air, members } = request.input;
  const windows = [air.bestWindow, air.worstWindow].flatMap((w) => (w ? w.split("-") : []));
  const times = members.flatMap((m) => m.activities.flatMap((a) => [a.usual, ...(a.rule.bestTime ? [a.rule.bestTime] : [])]));
  return [...windows, ...times].map(parseHhMm);
}

function parseReply(raw: string): PlanOutput | null {
  try {
    const result = planOutputSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Checks a reply against its request; null when the JSON or its shape is invalid, or nothing passed. */
export function validatePlan(raw: string, check: PlanCheck): ValidPlan | null {
  const reply = parseReply(raw);
  if (!reply) return null;
  const { input, tokens } = check.request;
  const ctx: FieldContext = {
    languages: input.languages,
    allowedTimes: allowedTimes(check.request),
    names: check.names,
    nameOf: check.nameOf,
  };
  const tally = new Tally();
  const general: FieldSpec = { cap: "doThis", forDependent: false };
  const people: Record<string, ValidPerson> = {};
  for (const member of reply.members) {
    const person: PlanInputPerson | undefined = input.members.find((m) => m.id === member.memberId);
    if (!person || tokens.people[person.id] in people) continue;
    people[tokens.people[person.id]] = checkMember(member, person, check.request, ctx, tally);
  }
  const seen = new Set<string>();
  const home = reply.home.flatMap((tip) => {
    if (!input.allowedTips.includes(tip.tipId) || seen.has(tip.tipId) || seen.size >= MAX_HOME_TIPS) return [];
    seen.add(tip.tipId);
    const doThis = tally.field(tip.doThis, general, ctx);
    const why = tip.why && tally.field(tip.why, { ...general, cap: "why" }, ctx);
    return doThis ? [{ tipId: tip.tipId, doThis, ...(why ? { why } : {}) }] : [];
  });
  const togetherText = reply.together?.altId === input.together ? tally.field(reply.together.doThis, general, ctx) : null;
  if (tally.passed === 0) return null;
  return {
    people,
    home,
    together: togetherText ? { altId: input.together, doThis: togetherText } : null,
    passed: tally.passed,
    failed: tally.failed,
    reasons: tally.reasons,
  };
}
