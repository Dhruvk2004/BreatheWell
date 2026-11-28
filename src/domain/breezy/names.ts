import { kinForms, kinOf, kinWordsIn, type Aliases } from "../names/kin";
import { sameNameAcrossScripts } from "../names/translit";
import { nearSpelling, withoutHonorific } from "../names/spelling";
import { normaliseWord, replacePhrases } from "../names/words";

/**
 * Names out, tokens in: before a question reaches Gemini, every stored name, the
 * viewer's own aliases and the Latin/Devanagari forms of kin words become the person's token
 * (`{m1}`, `{d1}`), and so does a name typed in the other script ("रिया" for a stored "Riya"). A kin word that is neither a stored name nor in the viewer's aliases is left
 * as it is and reported, so Breezy asks "Who do you mean by 'Papa'?" before anything is sent.
 */
export interface NamedPerson {
  /** Member uid or dependent id. */
  readonly id: string;
  readonly kind: "adult" | "dependent";
  /** The prompt token, "m1" or "d1". */
  readonly token: string;
  /** The stored name and any other spelling of it ("Dadaji", "दादाजी"). */
  readonly names: readonly string[];
  /**
   * What the name becomes instead of `{token}`: a person with no plan token ("a family member")
   * or the family's own name ("the family").
   */
  readonly replacement?: string;
}

/** What a person's name is swapped for. */
const markOf = (person: NamedPerson): string => person.replacement ?? `{${person.token}}`;

export interface TokenisedQuestion {
  readonly text: string;
  /** Kin keys with no person behind them yet ("papa"). */
  readonly unmapped: readonly string[];
}

/** The id an alias value points to: a member uid, or "dep:<did>" for a dependent. */
export const aliasTarget = (value: string): string => (value.startsWith("dep:") ? value.slice(4) : value);

/** The alias value stored for a person in the family's `aliases`. */
export const aliasValue = (person: Pick<NamedPerson, "id" | "kind">): string =>
  person.kind === "dependent" ? `dep:${person.id}` : person.id;

/** The person a kin key or alias stands for, if any. */
function personFor(key: string, people: readonly NamedPerson[], aliases: Aliases): NamedPerson | undefined {
  const alias = aliases[key];
  const byAlias = alias === undefined ? undefined : people.find((p) => p.id === aliasTarget(alias));
  return byAlias ?? people.find((p) => p.names.some((n) => kinOf(n)?.key === key || normaliseWord(n) === key));
}

/** A kin word's other spellings ("Dadaji" → "dada", "दादाजी", …); none for a plain name. */
function kinFormsOf(word: string): readonly string[] {
  const kin = kinOf(word);
  return kin ? kinForms(kin.key) : [];
}

/** Words of a name that are never a name on their own ("the Sharma family" → only "Sharma"). */
export const GENERIC_NAME_WORDS: ReadonlySet<string> = new Set([
  "the",
  "family",
  "parivar",
  "pariwar",
  "परिवार",
  "house",
  "home",
  "ghar",
  "घर",
  "ka",
  "ki",
  "ke",
  "का",
  "की",
  "के",
  "and",
]);

/** Each word (3+ letters) of a multi-word name: "Neha" or "Sharma" alone still means "Neha Sharma". */
const nameParts = (names: readonly string[]): string[] =>
  names.flatMap((n) => n.trim().split(/\s+/u)).filter((w) => [...w].length >= 3 && !GENERIC_NAME_WORDS.has(normaliseWord(w)));

/** Every phrase that means this person to this viewer. */
function phrasesFor(person: NamedPerson, aliases: Aliases): string[] {
  const own = Object.entries(aliases)
    .filter(([, value]) => aliasTarget(value) === person.id)
    .map(([key]) => key);
  const words = [...person.names, ...nameParts(person.names), ...own];
  return [...new Set(words.flatMap((w) => [w, ...kinFormsOf(w)]))];
}

const WORD = /[\p{L}\p{M}\p{N}]+/gu;

interface Spellings {
  readonly person: NamedPerson;
  /** Every word that means the person. */
  readonly words: readonly string[];
  /** The stored names' own words, for near spellings (not kin words or aliases). */
  readonly names: readonly string[];
}

/** A phrase's words that can be a name on their own (not "the", "family"). */
const ownWords = (phrase: string): string[] => phrase.split(/\s+/u).filter((w) => w && !GENERIC_NAME_WORDS.has(normaliseWord(w)));

/** True when the word (or it without "ji") is one of the person's words, the same or in the other script. */
function sameName(word: string, spellings: Spellings): boolean {
  const stem = withoutHonorific(word);
  return spellings.words.some(
    (name) =>
      sameNameAcrossScripts(word, name) ||
      sameNameAcrossScripts(stem, name) ||
      (stem !== word && normaliseWord(stem) === normaliseWord(name)),
  );
}

/**
 * Swaps each word that is a person's name in the other script ("नेहा" for "Neha"), with an honorific
 * ("Rameshji", "रमेशजी") or one letter off ("Riyaa") for the person's mark. Kin words are left to the
 * alias question.
 */
function swapWords(text: string, people: readonly NamedPerson[], aliases: Aliases): string {
  const all: Spellings[] = people.map((person) => ({
    person,
    words: phrasesFor(person, aliases).flatMap(ownWords),
    names: [...person.names, ...nameParts(person.names)].flatMap(ownWords),
  }));
  return text.normalize("NFC").replace(WORD, (word) => {
    const exact = all.find((s) => sameName(word, s));
    const stem = withoutHonorific(word);
    const near = exact ?? (kinOf(word) || kinOf(stem) ? undefined : all.find((s) => s.names.some((n) => nearSpelling(stem, n))));
    return near ? markOf(near.person) : word;
  });
}

/** Swaps names and aliases for tokens and lists the kin words still to ask about. Pure. */
export function tokeniseQuestion(text: string, people: readonly NamedPerson[], aliases: Aliases): TokenisedQuestion {
  const unmapped = kinWordsIn(text).filter((key) => !personFor(key, people, aliases));
  const swapped = people.reduce((out, p) => replacePhrases(out, phrasesFor(p, aliases), markOf(p)), text);
  return { text: swapWords(swapped, people, aliases), unmapped };
}
