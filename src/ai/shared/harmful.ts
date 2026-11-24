import { wordsOf } from "@/domain/names/words";
import { nfc, sentences } from "./text";

/**
 * Medical-safety and link checks by concept, not fixed phrase:
 * a sentence that pairs an inhaler, medicine or mask word with a skip or "not needed" word is
 * harmful in either order ("you can leave the inhaler at home", "Inhaler not required today",
 * "आज इनहेलर की ज़रूरत नहीं"), unless the skip verb is itself negated ("don't skip your inhaler").
 * Every web address or link scheme is refused, short links included.
 */
const CARE = ["inhaler", "inhalers", "pump", "medicine", "medicines", "medication", "nebuliser", "nebulizer", "mask", "masks", "n95"];
const CARE_STEMS = ["इनहेलर", "दवा", "दवाई", "मास्क", "पंप"].map(nfc);
const SKIP_VERBS = new Set(
  ["leave", "skip", "skipping", "stop", "stopping", "drop", "chhod", "chod", "छोड़", "छोड़ें", "छोड़िए", "छोड़कर"].map(nfc),
);
const NOT_NEEDED = [
  "not needed",
  "not required",
  "not necessary",
  "unnecessary",
  "no need for",
  "no need to carry",
  "no need to take",
  "no need to use",
  "no need to wear",
  "no need to keep",
  "dont need",
  "do not need",
  "neednt",
  "isnt needed",
  "isnt required",
  "zaroorat nahi",
  "jarurat nahi",
  "ज़रूरत नहीं",
  "जरूरत नहीं",
  "आवश्यकता नहीं",
  "न लें",
  "बंद करें",
  "बंद कर दें",
].map((p) => wordsOf(nfc(p)));
const NEGATIONS = new Set(["dont", "do", "never", "not", "मत", "न"]);

const plainWords = (text: string): string[] => wordsOf(text.replace(/['’]/gu, ""));

/** How many words apart the care word and the skip word may be ("leave the inhaler at home"). */
const NEAR = 3;

const isCare = (w: string) => CARE.includes(w) || CARE_STEMS.some((s) => w.startsWith(s));

/** Start indexes of a phrase in the words. */
const starts = (words: readonly string[], phrase: readonly string[]) =>
  words.flatMap((_, i) => (phrase.every((p, j) => words[i + j] === p) ? [i] : []));

/** Indexes of skip verbs that are not themselves negated ("don't skip", "never leave", "मत छोड़ें"). */
const skipAt = (words: readonly string[]) =>
  words.flatMap((w, i) => (SKIP_VERBS.has(w) && !words.slice(Math.max(0, i - 2), i).some((p) => NEGATIONS.has(p)) ? [i] : []));

/** True when a sentence tells someone to go without their inhaler, medicine or mask. */
export function harmfulAdvice(text: string): boolean {
  return sentences(nfc(text)).some((sentence) => {
    const words = plainWords(sentence);
    const care = words.flatMap((w, i) => (isCare(w) ? [i] : []));
    const skips = [...skipAt(words), ...NOT_NEEDED.flatMap((p) => starts(words, p))];
    return care.some((c) => skips.some((k) => Math.abs(c - k) <= NEAR + 1));
  });
}

const SCHEME = /\b(?:https?|ftp|mailto|tel|sms|whatsapp|javascript|data|intent):/iu;
const TLDS = "com|in|org|net|io|ly|me|xyz|co|app|info|biz|link|site|online|top|club|shop|live|store|tk|gl|gg|to|us|uk|ai|dev|page|ws|cc";
const DOMAIN = new RegExp(
  String.raw`(?:^|[\s(<"'])(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:${TLDS})(?:[/:?#]|(?![a-z0-9-]))`,
  "iu",
);
const ANY_PATH = /(?:^|\s)[a-z0-9-]+\.[a-z]{2,}\/\S/iu;

/** True when the text holds a web address, a short link or a link scheme. */
export const hasLink = (text: string): boolean => /\bwww\./iu.test(text) || SCHEME.test(text) || DOMAIN.test(text) || ANY_PATH.test(text);
