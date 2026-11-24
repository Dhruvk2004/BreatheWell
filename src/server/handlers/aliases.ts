import { aliasBody } from "@/domain/breezy/answer";
import { aliasValue } from "@/domain/breezy/names";
import { kinOf, MAX_ALIASES } from "@/domain/names/kin";
import { normaliseWord } from "@/domain/names/words";
import { familyOfCaller } from "../app/caller";
import { authorize } from "../auth/guard";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, privateJson, readJson } from "../http";
import { paths } from "../repos/paths";

/**
 * `PUT /api/aliases`: saves "Papa" → a member or dependent in the viewer's own
 * `users/{uid}.aliases`, after the alias question. The key is stored by its kin key ("papa" for
 * "पापा" too); at most 12 entries, and only people of the viewer's family.
 */
export async function saveAlias(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, aliasBody);
  if (!input.ok) return input.response;
  const { uid } = auth.session;
  const caller = await familyOfCaller(auth.db, uid);
  if (!caller) return forbidden();
  const { user, bundle } = caller;
  const { forId } = input.data;
  const kind = bundle.members.some((m) => m.uid === forId) ? "adult" : bundle.dependents.some((d) => d.id === forId) ? "dependent" : null;
  if (!kind) return forbidden();
  const key = kinOf(input.data.key)?.key ?? normaliseWord(input.data.key);
  const aliases = { ...user.aliases, [key]: aliasValue({ id: forId, kind }) };
  if (Object.keys(aliases).length > MAX_ALIASES) return errorResponse(409, "too_many", "You have saved 12 names already.");
  await auth.db.transaction(async (tx) => {
    tx.set(paths.user(uid), { aliases, updatedAt: deps.now().toISOString() }, { merge: true });
  });
  return privateJson({ ok: true });
}
