/**
 * Number normalisation before the "no air numbers" check: Devanagari digits become 0–9,
 * and number words ("three hundred", "तीन सौ") become digits, so a number cannot hide in words.
 */
const DEVANAGARI_ZERO = "०".charCodeAt(0);

/** ०–९ → 0–9. */
export const asciiDigits = (text: string): string => text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - DEVANAGARI_ZERO));

const EN_UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const HI_UNITS: Record<string, number> = {
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पाँच: 5,
  पांच: 5,
  छह: 6,
  छः: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  ग्यारह: 11,
  बारह: 12,
  पंद्रह: 15,
  बीस: 20,
  पच्चीस: 25,
  तीस: 30,
  चालीस: 40,
  पचास: 50,
  साठ: 60,
  सत्तर: 70,
  अस्सी: 80,
  नब्बे: 90,
};
const MULTIPLIERS: Record<string, number> = { hundred: 100, thousand: 1000, सौ: 100, हज़ार: 1000, हजार: 1000 };

const ALL_WORDS = [...Object.keys(EN_UNITS), ...Object.keys(HI_UNITS), ...Object.keys(MULTIPLIERS)].sort((x, y) => y.length - x.length);
const WORD = `(?:${ALL_WORDS.join("|")})`;
const RUN = new RegExp(`(?<![\\p{L}\\p{M}])${WORD}(?:(?:[\\s-]+|\\s+and\\s+)${WORD})*(?![\\p{L}\\p{M}])`, "giu");

/** The value of a run of number words, e.g. ["three", "hundred", "forty"] → 340. */
export function wordsValue(words: readonly string[]): number {
  let total = 0;
  let current = 0;
  for (const w of words) {
    const unit = EN_UNITS[w] ?? HI_UNITS[w];
    if (unit !== undefined) current += unit;
    else if (MULTIPLIERS[w] === 100) current = (current || 1) * 100;
    else {
      total += (current || 1) * MULTIPLIERS[w];
      current = 0;
    }
  }
  return total + current;
}

/** Replaces each run of number words ("three hundred and forty", "तीन सौ") with its digits. */
export function numberWordsToDigits(text: string): string {
  return text.replace(RUN, (run) => {
    const words = run
      .toLocaleLowerCase("en-IN")
      .split(/[\s-]+/)
      .filter((w) => w !== "and");
    return String(wordsValue(words));
  });
}

/** Both normalisations, digits first. */
export const normaliseNumbers = (text: string): string => numberWordsToDigits(asciiDigits(text));
