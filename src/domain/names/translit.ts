/**
 * Latin ↔ Devanagari name matching (spec 7.7.9). A family stores one spelling of each name; a
 * question may use the other script ("Riya" typed as "रिया", "नेहा" stored as "Neha"). Each word
 * is reduced to a rough Latin sound key, so both spellings of a common Indian first name meet:
 * Devanagari is read letter by letter, then vowel length, aspiration, doubled letters and the
 * inherent "a" are dropped. Used only to swap names for tokens, where a false match is safe.
 */
const CONSONANTS: Readonly<Record<string, string>> = {
  क: "k",
  ख: "kh",
  ग: "g",
  घ: "gh",
  ङ: "n",
  च: "ch",
  छ: "chh",
  ज: "j",
  झ: "jh",
  ञ: "n",
  ट: "t",
  ठ: "th",
  ड: "d",
  ढ: "dh",
  ण: "n",
  त: "t",
  थ: "th",
  द: "d",
  ध: "dh",
  न: "n",
  प: "p",
  फ: "ph",
  ब: "b",
  भ: "bh",
  म: "m",
  य: "y",
  र: "r",
  ल: "l",
  व: "v",
  श: "sh",
  ष: "sh",
  स: "s",
  ह: "h",
};
const VOWELS: Readonly<Record<string, string>> = {
  अ: "a",
  आ: "aa",
  इ: "i",
  ई: "ii",
  उ: "u",
  ऊ: "uu",
  ऋ: "ri",
  ए: "e",
  ऐ: "ai",
  ओ: "o",
  औ: "au",
};
const MATRAS: Readonly<Record<string, string>> = {
  "ा": "aa",
  "ि": "i",
  "ी": "ii",
  "ु": "u",
  "ू": "uu",
  "ृ": "ri",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au",
};
const VIRAMA = "्";
const NASAL: Readonly<Record<string, string>> = { "ं": "n", "ँ": "n", "ः": "h" };

const DEVANAGARI = /[ऀ-ॿ]/u;

/** True when the word is written in Devanagari. */
export const isDevanagari = (word: string): boolean => DEVANAGARI.test(word);

/** A Devanagari word read letter by letter into Latin ("रिया" → "riyaa", "प्रिया" → "priyaa"). */
export function devanagariToLatin(word: string): string {
  let out = "";
  let inherent = false;
  for (const ch of word.normalize("NFD")) {
    const letter = CONSONANTS[ch] ?? VOWELS[ch] ?? NASAL[ch];
    const sign = ch === VIRAMA ? "" : MATRAS[ch];
    if (letter !== undefined) {
      if (inherent) out += "a";
      inherent = ch in CONSONANTS;
      out += letter;
    } else if (sign !== undefined) {
      out += sign;
      inherent = false;
    }
  }
  return out;
}

/** The sound key both spellings of a name share ("Riya", "रिया" → "riy"; "Kamla", "कमला" → "kml"). */
export function soundKey(word: string): string {
  const latin = (isDevanagari(word) ? devanagariToLatin(word) : word).normalize("NFC").toLocaleLowerCase("en-IN");
  const head = latin
    .replace(/[^a-z]/gu, "")
    .replace(/w/gu, "v")
    .replace(/z/gu, "j")
    .replace(/q/gu, "k");
  const plain = head
    .replace(/([bcdgjkptsr])h/gu, "$1")
    .replace(/([bcdgjkptsr])h/gu, "$1")
    .replace(/ee|ii/gu, "i")
    .replace(/oo|uu/gu, "u")
    .replace(/(.)\1+/gu, "$1");
  return plain.slice(0, 1) + plain.slice(1).replace(/a/gu, "");
}

/** True when two words are the same name in different scripts. */
export function sameNameAcrossScripts(word: string, name: string): boolean {
  if (isDevanagari(word) === isDevanagari(name)) return false;
  const key = soundKey(word);
  return key.length >= 2 && key === soundKey(name);
}
