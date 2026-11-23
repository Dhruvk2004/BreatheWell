import { z } from "zod";

/** Letters in any script, marks, digits, spaces and . ' - : what people call each other ("Dadaji", "दादाजी"). */
const NAME_CHARS = /^[\p{L}\p{M}\p{N} .'-]+$/u;

/** A name typed by an adult: trimmed, `max` characters, no links or symbols (shown to the family only). */
export const nameSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(NAME_CHARS)
    // No domains ("site.com", "a.co"): a dot may only follow an initial, as in "R.K. Laxman" (stage 8 QA8-5).
    .refine((name) => !/[\p{L}\p{N}]\.[\p{L}\p{N}]{2,}/u.test(name));

/**
 * A name that came from outside a validated form (the Google display name, a stored profile):
 * kept when it passes `nameSchema`, else empty, so a link or symbol name never reaches the family
 * (stage 7 AUTH-3, WEB-6). Onboarding asks for the name again.
 */
export function safeName(raw: string, max = 30): string {
  const result = nameSchema(max).safeParse(raw);
  return result.success ? result.data : "";
}

/** Shown for an adult whose Google name could not be used, until they type one in onboarding (QA8-6). */
export const UNNAMED_MEMBER = "New member · नया सदस्य";
