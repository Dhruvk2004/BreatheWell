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
    .refine((name) => !/[\p{L}\p{N}]\.[\p{L}\p{N}]/u.test(name));

/**
 * A name that came from outside a validated form (the Google display name, a stored profile):
 * kept when it passes `nameSchema`, else empty, so a link or symbol name never reaches the family
 * (stage 7 AUTH-3, WEB-6). Onboarding asks for the name again.
 */
export function safeName(raw: string, max = 30): string {
  const result = nameSchema(max).safeParse(raw);
  return result.success ? result.data : "";
}
