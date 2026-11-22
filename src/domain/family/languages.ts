import { LANGS, type Lang } from "../time/format";

/** An adult as far as the plan's languages go. */
export interface LanguageUser {
  readonly language: Lang;
  /** Onboarded, so planned today. */
  readonly planned: boolean;
  readonly admin: boolean;
}

/**
 * The languages a family's plan is written in (spec 7.2): each planned adult's plus the admin's,
 * in a fixed order. Dependents' card languages never count (they are not sent to Gemini).
 */
export function familyLanguages(adults: readonly LanguageUser[]): Lang[] {
  const used = new Set(adults.filter((a) => a.planned || a.admin).map((a) => a.language));
  return LANGS.filter((lang) => used.has(lang));
}
