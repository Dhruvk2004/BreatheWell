import { codeRecord, newJoinCode } from "@/domain/family/joinCode";
import type { Tx } from "../db/types";
import { paths } from "./paths";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A code no other family holds (reads only; 31⁸ codes make a clash very unlikely, but it is checked). */
export async function freshCode(tx: Tx, random: (size: number) => Uint8Array): Promise<string> {
  for (;;) {
    const code = newJoinCode(random);
    if (!(await tx.get(paths.joinCode(code)))) return code;
  }
}

/** The family's codes (normally one), so a new code can replace them. */
export async function familyCodes(tx: Tx, fid: string): Promise<string[]> {
  return (await tx.query(paths.joinCodes, [{ field: "familyId", value: fid }])).map(({ id }) => id);
}

/**
 * Writes a new code: valid for 24 h and 8 joins; `expireAt` lets the TTL policy delete it one day
 * after expiry (spec 9.4). Only the server reads or writes `joinCodes` (spec 9.2).
 */
export function writeCode(tx: Tx, code: string, fid: string, uid: string, now: Date): { code: string; expiresAt: string } {
  const record = codeRecord(now);
  const expireAt = new Date(Date.parse(record.expiresAt) + DAY_MS).toISOString();
  tx.set(paths.joinCode(code), { familyId: fid, createdBy: uid, ...record, createdAt: now.toISOString(), expireAt });
  return { code, expiresAt: record.expiresAt };
}
