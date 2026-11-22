import { cronSecret } from "@/config/env";
import { adminFirestore } from "@/firebase/admin";
import { firestoreSweeper } from "@/firebase/firestoreDb";
import type { CleanupDeps } from "../handlers/cleanup";
import { jsonLog } from "../runtime";

type Env = Readonly<Record<string, string | undefined>>;

/** The clean-up route's production deps; a broken credential leaves the sweeper off, not a crash. */
export function cleanupDeps(env: Env): CleanupDeps {
  let sweeper: CleanupDeps["sweeper"] = null;
  try {
    const firestore = adminFirestore(env);
    sweeper = firestore ? firestoreSweeper(firestore) : null;
  } catch {
    sweeper = null;
  }
  return { secret: cronSecret(env), sweeper, clock: () => new Date(), log: jsonLog };
}
