import { wordsOf } from "../names/words";
import { foldText } from "../text/fold";
import { ALARM_SEQUENCES, ALARM_WORDS, BREATH_WORDS, CHEST_TROUBLE, CHEST_WORDS, TROUBLE_WORDS } from "./emergencyWords";
import { INHALER_FAILING, INHALER_WORDS, NEGATIONS } from "./emergencyMore";

/**
 * How many words apart a breath word and a trouble word may be: "सांस लेने में बहुत तकलीफ" puts
 * तकलीफ 4 words after सांस (stage 7 AI-2; was 3).
 */
const NEAR = 5;

/** Lower case, no apostrophes ("can't" → "cant"), no nukta, chandrabindu as anusvara. */
function normalWords(text: string): string[] {
  const plain = foldText(text)
    .replace(/['’‘`]/g, "")
    .normalize("NFD")
    .replace(/़/g, "")
    .replace(/ँ/g, "ं")
    .normalize("NFC");
  return wordsOf(plain);
}

/** True when a word from `a` and a word from `b` are at most `NEAR` words apart. */
function near(words: readonly string[], a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return words.some((word, i) => {
    if (!a.has(word)) return false;
    const around = words.slice(Math.max(0, i - NEAR), i + NEAR + 1);
    return around.some((other) => b.has(other));
  });
}

/** True when an inhaler word has both a "helping/working" word and a negation near it ("inhaler is not helping"). */
function inhalerFailing(words: readonly string[]): boolean {
  return words.some((word, i) => {
    if (!INHALER_WORDS.has(word)) return false;
    const around = words.slice(Math.max(0, i - NEAR), i + NEAR + 1);
    return around.some((w) => INHALER_FAILING.has(w)) && around.some((w) => NEGATIONS.has(w));
  });
}

/** True when `sequence` appears as consecutive words. */
function hasSequence(words: readonly string[], sequence: readonly string[]): boolean {
  return words.some((_, i) => sequence.every((w, j) => words[i + j] === w));
}

/**
 * True when the text describes a breathing emergency (spec 5.11, 7.7.5): breath words near
 * "can't", "difficulty", "short", "nahi", "दिक्कत" and so on; chest pain or tightness; an asthma
 * attack; fainting; wheezing; lips turning blue; an inhaler that is not helping. Patterns, not fixed phrases, so the common ways people
 * describe breathlessness in English, Hinglish and Devanagari are all caught. When true, the fixed
 * text with Call 112 is shown and Gemini is not called.
 */
export function isEmergency(text: string): boolean {
  const words = normalWords(text);
  return (
    words.some((w) => ALARM_WORDS.has(w)) ||
    near(words, BREATH_WORDS, TROUBLE_WORDS) ||
    near(words, CHEST_WORDS, CHEST_TROUBLE) ||
    inhalerFailing(words) ||
    ALARM_SEQUENCES.some((sequence) => hasSequence(words, sequence))
  );
}
