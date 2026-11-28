import { z } from "zod";
import { firstName, MAX_ADULTS } from "@/domain/family/caps";
import { codeState, normaliseCode } from "@/domain/family/joinCode";
import { safeName } from "@/domain/members/names";
import { SETTING_UP_PROFILE } from "@/domain/members/profile";
import { authorize } from "../auth/guard";
import type { Tx } from "../db/types";
import type { AppDeps } from "../deps";
import { errorResponse, privateJson, readJson } from "../http";
import { markPlanStale } from "../repos/family";
import { allowJoinAttempt } from "../repos/joinAttempts";
import { paths } from "../repos/paths";
import { familyRecord, joinCodeRecord, parsed, userRecord, type FamilyRecord, type UserRecord } from "../repos/records";

/**
 * `POST /api/join`: a signed-in adult with no family, a valid active unexpired code, a family under
 * 6 adults. An expired code names the admin's first name only. The code only adds the person; it
 * never creates or fills a profile. Every answer takes at least `JOIN_MIN_MS`, so timing never hints whether a family exists.
 */
const body = z.strictObject({ code: z.string().max(20) });
export const JOIN_MIN_MS = 600;

type Outcome =
  | { kind: "joined" | "already_member"; familyName: string }
  | { kind: "not_found" | "not_adult" }
  | { kind: "expired" | "removed"; adminName: string }
  | { kind: "full"; familyName: string; adminName: string }
  | { kind: "in_other_family"; familyName: string };

const adminName = async (tx: Tx, family: FamilyRecord): Promise<string> =>
  firstName(parsed(userRecord, await tx.get(paths.user(family.adminUid)))?.name ?? "");

function addMember(tx: Tx, fid: string, family: FamilyRecord, user: UserRecord, uid: string, code: string, now: Date): void {
  const at = now.toISOString();
  const { language, onboarded } = user;
  tx.set(paths.family(fid), { memberUids: [...family.memberUids, uid] }, { merge: true });
  tx.set(paths.member(fid, uid), {
    name: safeName(user.name),
    language,
    onboarded,
    ...(user.profile ?? SETTING_UP_PROFILE),
    joinedAt: at,
    joinedVia: { code, at },
  });
  tx.set(paths.user(uid), { familyId: fid, role: "member", removedFrom: null, updatedAt: at }, { merge: true });
  markPlanStale(tx, fid, now);
}

async function join(tx: Tx, uid: string, code: string, now: Date): Promise<Outcome> {
  const user = parsed(userRecord, await tx.get(paths.user(uid)));
  const record = parsed(joinCodeRecord, await tx.get(paths.joinCode(code)));
  const family = record ? parsed(familyRecord, await tx.get(paths.family(record.familyId))) : null;
  const other =
    user?.familyId && user.familyId !== record?.familyId ? parsed(familyRecord, await tx.get(paths.family(user.familyId))) : null;
  if (!user || !record || !family) return { kind: "not_found" };
  if (!user.adultConfirmedAt) return { kind: "not_adult" };
  if (user.familyId === record.familyId && family.memberUids.includes(uid)) return { kind: "already_member", familyName: family.name };
  // A familyId whose family is gone, or no longer lists the user, is "no family".
  if (other?.memberUids.includes(uid)) return { kind: "in_other_family", familyName: other.name };
  const admin = await adminName(tx, family);
  // Removed while this code existed: only a code made after the removal lets them back.
  if (record.removedUids.includes(uid)) return { kind: "removed", adminName: admin };
  if (codeState(record, now) === "expired") return { kind: "expired", adminName: admin };
  if (family.memberUids.length >= MAX_ADULTS) return { kind: "full", familyName: family.name, adminName: admin };
  addMember(tx, record.familyId, family, user, uid, code, now);
  tx.set(paths.joinCode(code), { uses: record.uses + 1 }, { merge: true });
  return { kind: "joined", familyName: family.name };
}

const STATUS: Readonly<Record<Outcome["kind"], number>> = {
  joined: 200,
  already_member: 200,
  not_found: 404,
  not_adult: 403,
  expired: 410,
  removed: 403,
  full: 409,
  in_other_family: 409,
};

export async function joinFamily(request: Request, deps: AppDeps): Promise<Response> {
  const started = deps.now().getTime();
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, body);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const settle = () => deps.pause(Math.max(0, JOIN_MIN_MS - (deps.now().getTime() - started)));
  if (!(await allowJoinAttempt(auth.db, uid, deps.now()))) {
    await settle();
    return errorResponse(429, "too_many_tries", "Too many tries. Wait 10 minutes.", { "Retry-After": "600" });
  }
  const code = normaliseCode(input.data.code);
  const outcome: Outcome = code ? await auth.db.transaction((tx) => join(tx, uid, code, deps.now())) : { kind: "not_found" };
  await settle();
  if (outcome.kind === "joined") deps.log("member_joined", { uid });
  return privateJson(outcome, STATUS[outcome.kind]);
}
