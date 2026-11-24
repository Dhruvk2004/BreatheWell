import { GENERIC_NAME_WORDS, type NamedPerson } from "@/domain/breezy/names";
import type { Lang } from "@/domain/time/format";
import type { FamilyBundle } from "../repos/family";

/**
 * Names never sent, for everyone, not only the planned people (stage 7
 * AI-3): a member who joined but has no plan yet, or a dependent with no row, has no token, so
 * their name becomes "a family member"; the family's own name ("Sharma family", "Sharma") becomes
 * "the family". Planned people keep their tokens.
 */
const NEUTRAL: Readonly<Record<Lang, { readonly person: string; readonly family: string }>> = {
  en: { person: "a family member", family: "the family" },
  hi: { person: "परिवार का एक सदस्य", family: "परिवार" },
};

/** The family name's phrases: "the …" and the whole name (its own words are added as name parts). */
function familyPhrases(name: string): string[] {
  const whole = name.trim();
  const words = whole.split(/\s+/u).filter((w) => !GENERIC_NAME_WORDS.has(w.toLocaleLowerCase("en-IN")));
  return words.length ? [`the ${whole}`, whole] : [];
}

/** Every person the question may name: planned people first, then everyone else and the family name. */
export function privacyPeople(bundle: FamilyBundle, planned: readonly NamedPerson[], lang: Lang): NamedPerson[] {
  const known = new Set(planned.map((p) => p.id));
  const neutral = NEUTRAL[lang];
  const everyone = [
    ...bundle.members.map((m) => ({ id: m.uid, kind: "adult" as const, name: m.record.name })),
    ...bundle.dependents.map((d) => ({ id: d.id, kind: "dependent" as const, name: d.record.name })),
  ];
  const others = everyone
    .filter((o) => !known.has(o.id) && o.name.trim())
    .map((o): NamedPerson => ({ id: o.id, kind: o.kind, token: "", names: [o.name], replacement: neutral.person }));
  const family: NamedPerson = { id: "", kind: "adult", token: "", names: [], replacement: neutral.family };
  return [...planned, ...others, { ...family, names: familyPhrases(bundle.family.name) }];
}
