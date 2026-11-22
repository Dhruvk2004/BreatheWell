import { isAdmin } from "@/domain/family/permissions";
import { codeState, normaliseCode } from "@/domain/family/joinCode";
import { firstName } from "@/domain/family/caps";
import type { InvitePage, InvitePreview } from "@/view/app";
import { dbOf, type AppDeps } from "../deps";
import { checkClient } from "../rateLimit";
import { paths } from "../repos/paths";
import { familyRecord, joinCodeRecord, parsed, userRecord } from "../repos/records";
import type { InFamily } from "./guards";
import type { Viewer } from "./viewer";

/** The join link for a code (spec 5.3): `https://<app>/join/K7PM4QXT`, always absolute (QR, WhatsApp). */
export const joinUrl = (origin: string, code: string): string => `${origin}/join/${code}`;

/** The family's live join code, read by the server only (spec 9.2); null when none is valid. */
export async function liveCode(viewer: InFamily, deps: AppDeps): Promise<{ code: string; expiresAt: string } | null> {
  const docs = await dbOf(deps).query(paths.joinCodes, [{ field: "familyId", value: viewer.bundle.id }]);
  for (const { id, data } of docs) {
    const record = parsed(joinCodeRecord, data);
    if (record && codeState(record, deps.now()) === "valid") return { code: id, expiresAt: record.expiresAt };
  }
  return null;
}

/**
 * The admin's Invite page (spec 10.7): the family's live code, or none (then "Make a new code").
 * Non-admins get null and see the read-only note. `origin` comes from `siteOrigin`.
 */
export async function loadInvite(viewer: InFamily, deps: AppDeps, origin: string): Promise<InvitePage | null> {
  if (!isAdmin(viewer.bundle.family, viewer.uid)) return null;
  const live = await liveCode(viewer, deps);
  return {
    familyName: viewer.bundle.family.name,
    code: live?.code ?? null,
    expiresAt: live?.expiresAt ?? null,
    joinUrl: live ? joinUrl(origin, live.code) : null,
  };
}

/**
 * `/join/[code]` (spec 5.4, 5.11): shows the family name and the admin's first name only for a code
 * the server has checked; an expired code names the admin only. Per-IP limited (30 an hour) so the
 * page cannot be used to probe codes.
 */
export async function loadInvitePreview(raw: string, headers: Headers, deps: AppDeps): Promise<InvitePreview> {
  if (!deps.db) return { kind: "not_configured" };
  if (!checkClient(deps.limits.invite, headers).allowed) return { kind: "rate_limited" };
  const code = normaliseCode(raw);
  const record = code ? parsed(joinCodeRecord, await deps.db.get(paths.joinCode(code))) : null;
  const family = record ? parsed(familyRecord, await deps.db.get(paths.family(record.familyId))) : null;
  if (!code || !record || !family) return { kind: "not_found" };
  const admin = parsed(userRecord, await deps.db.get(paths.user(family.adminUid)));
  const adminName = firstName(admin?.name ?? "");
  if (codeState(record, deps.now()) === "expired") return { kind: "expired", adminName };
  return { kind: "valid", code, familyName: family.name, adminName, expiresAt: record.expiresAt };
}

/** Everything `/join/[code]` shows: the checked invite and who is looking (spec 5.4). */
export async function loadJoinPage(raw: string, headers: Headers, viewer: Viewer, deps: AppDeps) {
  const preview = await loadInvitePreview(raw, headers, deps);
  const signedIn = viewer.kind === "signed_in";
  return {
    preview,
    viewer: {
      signedIn,
      onboarded: signedIn && viewer.user.onboarded,
      familyName: signedIn ? (viewer.bundle?.family.name ?? null) : null,
    },
    expiresAt: preview.kind === "valid" ? preview.expiresAt : null,
  };
}
