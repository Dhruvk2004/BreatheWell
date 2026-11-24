import { firstName } from "@/domain/family/caps";
import { safeName } from "@/domain/members/names";
import type { Db, DocData } from "../db/types";
import { paths } from "./paths";
import { parsed, userRecord, type UserRecord } from "./records";

/** A user's profile document, or null. */
export async function readUser(db: Pick<Db, "get">, uid: string): Promise<UserRecord | null> {
  return parsed(userRecord, await db.get(paths.user(uid)));
}

/** The first profile: the Google first name (when it is a plain name) pre-fills "What does the family call you?". */
function newUserDoc(googleName: string, now: string): DocData {
  return {
    name: safeName(firstName(googleName).slice(0, 30)),
    language: "en",
    familyId: null,
    role: null,
    onboarded: false,
    adultConfirmedAt: now,
    aliases: {},
    profile: null,
    removedFrom: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates the profile on first sign-in, or refreshes `adultConfirmedAt` (set by the
 * server from the 18+ tick that came before every sign-in). Returns the stored profile.
 */
export async function ensureUser(db: Db, uid: string, googleName: string, now: Date): Promise<UserRecord> {
  const at = now.toISOString();
  return db.transaction(async (tx) => {
    const current = parsed(userRecord, await tx.get(paths.user(uid)));
    if (current) {
      tx.set(paths.user(uid), { adultConfirmedAt: at, updatedAt: at }, { merge: true });
      return { ...current, adultConfirmedAt: at };
    }
    const created = newUserDoc(googleName, at);
    tx.set(paths.user(uid), created);
    return userRecord.parse(created);
  });
}
