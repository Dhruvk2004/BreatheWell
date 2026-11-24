/** Family size in v1 (spec 4.1 F6, decision 8): 6 adult accounts plus up to 4 dependents. */
export const MAX_ADULTS = 6;
export const MAX_DEPENDENTS = 4;

/** Join cards on Today show joins from the last day. */
export const JOIN_CARD_MS = 24 * 60 * 60 * 1000;

/** The first word of a name: the admin's first name on the invite page ("Neha invited you"). */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0];

/** Two initials for the avatar ("Neha Sharma" → "NS", "Dadaji" → "D"); letters only. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.map((w) => [...w].find((c) => /\p{L}/u.test(c)) ?? "").filter(Boolean);
  return (letters.length > 1 ? letters[0] + letters[letters.length - 1] : (letters[0] ?? "")).toUpperCase();
}
