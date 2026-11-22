/**
 * Join codes (spec 5.3, 11.2): 8 characters from a 31-symbol alphabet with no 0, O, 1, I or L
 * (about 8.5 × 10¹¹ codes), shown as K7PM-4QXT, typed in any case with or without the hyphen;
 * valid for 24 hours and at most 8 joins, whichever comes first.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 8;
export const CODE_TTL_MS = 24 * 60 * 60 * 1000;
export const CODE_MAX_USES = 8;

/** Bytes at or above this are skipped, so every symbol is equally likely (31 × 8 = 248). */
const UNBIASED_LIMIT = CODE_ALPHABET.length * Math.floor(256 / CODE_ALPHABET.length);

/**
 * A new code from a secure random source (`crypto.randomBytes` on the server). Rejection sampling
 * keeps the 31 symbols uniform.
 */
export function newJoinCode(random: (size: number) => Uint8Array): string {
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const byte of random(CODE_LENGTH * 2)) {
      if (byte < UNBIASED_LIMIT && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

/** The stored form of a typed code ("k7pm-4qxt" → "K7PM4QXT"), or null when it cannot be a code. */
export function normaliseCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** "K7PM4QXT" → "K7PM-4QXT". */
export const formatCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;

export interface CodeRecord {
  readonly expiresAt: string;
  readonly uses: number;
  readonly maxUses: number;
  readonly active: boolean;
}

export type CodeState = "valid" | "expired";

/** Valid until 24 h have passed or the eighth join; a regenerated code is inactive at once. */
export function codeState(code: CodeRecord, now: Date): CodeState {
  const live = code.active && code.uses < code.maxUses && Date.parse(code.expiresAt) > now.getTime();
  return live ? "valid" : "expired";
}

/** The new code's record, created by the admin at `now`. */
export const codeRecord = (now: Date): CodeRecord => ({
  expiresAt: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
  uses: 0,
  maxUses: CODE_MAX_USES,
  active: true,
});
