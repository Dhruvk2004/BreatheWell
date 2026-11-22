import { dayTimes } from "@/ai/breezy/input";
import { rejectsTime, type HourAllowed } from "@/ai/breezy/timeCheck";
import { BREEZY_CAPS } from "@/ai/breezy/validate";
import { checkText } from "@/ai/shared/validate";
import { actionBody, type ActionBody } from "@/domain/breezy/answer";
import { isFactId } from "@/domain/impact/facts";
import { passesKidChecks } from "@/domain/libraries/kid";
import { parseHhMm, type Lang } from "@/domain/time";
import { t } from "@/i18n/t";
import { familyOfCaller } from "../app/caller";
import { planFamilyToday } from "../app/familyPlan";
import { authorize } from "../auth/guard";
import { hourAllowedFor, ruleContextOf } from "../breezy/slot";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, privateJson, readJson } from "../http";
import { addItem } from "../repos/breezyItems";
import type { FamilyBundle } from "../repos/family";
import { forbiddenNames } from "../plan/context";

/**
 * `POST /api/breezy/action` (spec 7.7.4, 9.3): what an adult confirmed on the sheet. The server
 * trusts none of it: the target must be in the caller's family, the fact id must be a library id,
 * both texts pass the validator again with the rules on every time they name, and for a plan item
 * the rules run again for its time (an hour that is no longer allowed is refused). A dependent's
 * item that fails the kid-card checks is saved for the parent's view only.
 */
interface Target {
  readonly id: string;
  readonly name: string;
  readonly kind: "adult" | "dependent";
  readonly language: Lang;
}

function targetIn(bundle: FamilyBundle, id: string): Target | null {
  const member = bundle.members.find((m) => m.uid === id);
  if (member) return { id, name: member.record.name, kind: "adult", language: member.record.language };
  const dep = bundle.dependents.find((d) => d.id === id);
  return dep ? { id, name: dep.record.name, kind: "dependent", language: dep.record.cardLanguage } : null;
}

/** True when both languages pass the shared validator and name no outing at an hour the rules refuse. */
function textPasses(body: ActionBody, bundle: FamilyBundle, target: Target, allowed: HourAllowed): boolean {
  const names = forbiddenNames(bundle);
  const forDependent = target.kind === "dependent";
  const scope = { people: [], defaults: [target.id], date: body.date, allowed };
  return (["en", "hi"] as const).every((lang) => {
    const rules = { lang, maxLength: BREEZY_CAPS.item, allowedTimes: dayTimes(), names, forDependent };
    return checkText(body.item[lang], rules).length === 0 && !rejectsTime(body.item[lang], scope);
  });
}

/** For a plan item: the rules must still allow this time (spec 7.7.7). */
function timeAllowed(body: ActionBody, allowed: HourAllowed): boolean {
  if (body.type === "add_checklist") return true;
  if (!body.time || !body.activity) return false;
  return allowed(body.forId, body.activity, body.date, parseHhMm(body.time).hour);
}

/** The rules of the family's day today, for the action's times. */
async function rulesOf(bundle: FamilyBundle, uid: string, deps: AppDeps): Promise<HourAllowed> {
  const planned = await planFamilyToday(bundle, uid, deps.air);
  const day = planned.day;
  return hourAllowedFor(day ? { day, ctx: ruleContextOf(day.summary.date, planned.region) } : null);
}

const validFact = (body: ActionBody): boolean => body.factId === null || isFactId(body.factId);

export async function breezyAction(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, actionBody);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const body = input.data;
  const caller = await familyOfCaller(auth.db, uid);
  const target = caller ? targetIn(caller.bundle, body.forId) : null;
  if (!caller || !target) return forbidden();
  const { bundle, user } = caller;
  const allowed = await rulesOf(bundle, uid, deps);
  if (!validFact(body) || !textPasses(body, bundle, target, allowed)) return errorResponse(400, "invalid_item", "Ask Breezy again.");
  if (!timeAllowed(body, allowed)) return errorResponse(409, "rules_changed", "The air changed. Ask Breezy again.");
  const adder = bundle.members.find((m) => m.uid === uid)?.record.name ?? user.name;
  const saved = await addItem(auth.db, bundle.id, { body, forId: target.id, by: { uid, name: adder }, now: deps.now() });
  if (!saved) return forbidden();
  // The kid card shows the text in its own language and checks only that (repos/items.ts), so the
  // confirmation says the same (stage 7 AI-9).
  const onCard = target.kind === "adult" || passesKidChecks(body.item[target.language]);
  const whatsapp =
    target.kind === "adult" && target.id !== uid
      ? t(target.language, "breezy.wa.text", { name: target.name, text: body.item[target.language], from: adder })
      : null;
  return privateJson({ ok: true, onCard, whatsapp });
}
