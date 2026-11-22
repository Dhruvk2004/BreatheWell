import { wordsOf, normaliseWord } from "./words";

/** One kin word with its Latin (incl. Hinglish) and Devanagari spellings (spec 7.7.9). */
export interface KinWord {
  readonly key: string;
  readonly forms: readonly string[];
}

/** The kin-word list (`domain/names/kin.ts`, spec 7.7.9), EN/Latin ↔ Devanagari. */
export const KIN_WORDS: readonly KinWord[] = [
  { key: "papa", forms: ["papa", "पापा"] },
  { key: "mummy", forms: ["mummy", "mumma", "मम्मी"] },
  { key: "dadaji", forms: ["dadaji", "dada", "दादाजी", "दादा"] },
  { key: "dadi", forms: ["dadi", "दादी"] },
  { key: "nanaji", forms: ["nanaji", "नानाजी"] },
  { key: "nani", forms: ["nani", "नानी"] },
  { key: "bhaiya", forms: ["bhaiya", "भैया"] },
  { key: "didi", forms: ["didi", "दीदी"] },
  { key: "chacha", forms: ["chacha", "चाचा"] },
  { key: "bua", forms: ["bua", "बुआ"] },
];

const BY_FORM = new Map(KIN_WORDS.flatMap((k) => k.forms.map((f) => [normaliseWord(f), k] as const)));

/** The kin word a single word stands for ("Dadaji", "dadaji" and "दादाजी" → "dadaji"), or undefined. */
export const kinOf = (word: string): KinWord | undefined => BY_FORM.get(normaliseWord(word));

/** Every kin word in a text, by key, in order of first use. */
export function kinWordsIn(text: string): string[] {
  const keys = wordsOf(text).flatMap((w) => {
    const kin = kinOf(w);
    return kin ? [kin.key] : [];
  });
  return keys.filter((k, i) => keys.indexOf(k) === i);
}

/** A viewer's private aliases: kin key or name → member uid or "dep:<did>" (spec 9.1, ≤ 12 entries). */
export type Aliases = Readonly<Record<string, string>>;

export const MAX_ALIASES = 12;
export const MAX_ALIAS_KEY = 20;

/**
 * Kin words in a question that the viewer has not mapped yet: Breezy asks "Who do you mean by
 * 'Papa'?" for these before anything is sent (spec 7.7.9).
 */
export function unmappedKin(text: string, aliases: Aliases): string[] {
  return kinWordsIn(text).filter((key) => aliases[key] === undefined);
}

/** All spellings to swap for a mapped kin key (Latin and Devanagari). */
export const kinForms = (key: string): readonly string[] => KIN_WORDS.find((k) => k.key === key)?.forms ?? [key];
