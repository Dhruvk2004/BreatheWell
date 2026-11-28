import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { tokeniseQuestion, type NamedPerson } from "@/domain/breezy/names";
import { firstName } from "@/domain/family/caps";
import { isEmergency } from "@/domain/safety/emergency";
import { EMERGENCY_NEGATIVE, EMERGENCY_POSITIVE } from "../../fixtures/corpus/emergency";

/**
 * Safety properties of the pure code in front of Gemini: no name, name
 * word, alias or other-script spelling survives tokenisation, and the emergency matcher does not
 * depend on case, apostrophes or the words around the phrase.
 */
const PEOPLE: NamedPerson[] = [
  { id: "neha", kind: "adult", token: "m1", names: ["Neha Sharma"] },
  { id: "ramesh", kind: "adult", token: "m2", names: ["Dadaji"] },
  { id: "riya", kind: "dependent", token: "d1", names: ["Riya"] },
  { id: "aarav", kind: "dependent", token: "d2", names: ["आरव"] },
];
const ALIASES = { papa: "ramesh", gudiya: "dep:riya" };
/** Every way the family might write one of them, and the word that must not reach Gemini. */
const FORMS = [
  ["Neha Sharma", "neha"],
  ["NEHA", "neha"],
  ["sharma", "sharma"],
  ["नेहा", "नेहा"],
  ["Dadaji", "dadaji"],
  ["दादाजी", "दादाजी"],
  ["dada", "dada"],
  ["Papa", "papa"],
  ["पापा", "पापा"],
  ["Riya", "riya"],
  ["रिया", "रिया"],
  ["Gudiya", "gudiya"],
  ["आरव", "आरव"],
  ["Aarav", "aarav"],
] as const;
const FILLER = ["can", "go", "out", "today", "walk", "at", "3", "pm", "is", "the", "park", "ok", "for", "कब", "बाहर", "ki", "with"];

const sentence = fc.tuple(
  fc.array(fc.constantFrom(...FILLER), { maxLength: 6 }),
  fc.constantFrom(...FORMS),
  fc.array(fc.constantFrom(...FILLER), { maxLength: 6 }),
  fc.constantFrom("", "'s", "?", ",", "!"),
);

describe("tokenisation never lets a name through", () => {
  it("swaps every name, name word, alias and other-script spelling for a token", () => {
    fc.assert(
      fc.property(sentence, ([before, [form, word], after, tail]) => {
        const text = [...before, `${form}${tail}`, ...after].join(" ");
        const out = tokeniseQuestion(text, PEOPLE, ALIASES);
        expect(out.text.toLowerCase().split(/[^\p{L}\p{M}]+/u)).not.toContain(word);
        expect(out.text).toMatch(/\{[md]\d\}/u);
        expect(out.unmapped).toEqual([]);
      }),
    );
  });

  it("regression: the first name or surname alone of a two-word stored name becomes the token", () => {
    expect(tokeniseQuestion("Can Neha walk at 3 pm?", PEOPLE, {}).text).toBe("Can {m1} walk at 3 pm?");
    expect(tokeniseQuestion("Is Sharma ji free?", PEOPLE, {}).text).toBe("Is {m1} ji free?");
    expect(tokeniseQuestion("riya-neha", PEOPLE, {}).text).toBe("{d1}-{m1}");
  });

  it("leaves a kin word with no alias as it is and flags it, so nothing is sent", () => {
    const out = tokeniseQuestion("Can Mummy and Papa go out?", PEOPLE, {});
    expect(out.unmapped).toEqual(expect.arrayContaining(["mummy", "papa"]));
  });
});

describe("emergency matcher (properties over the corpus)", () => {
  const noise = fc.array(fc.constantFrom("please", "help", "Breezy", "now", "today", "hi", "ok", "."), { maxLength: 4 });
  const caseOf = (text: string, upper: boolean) => (upper ? text.toUpperCase() : text.toLowerCase());

  it("every corpus phrase is caught whatever surrounds it and in any case", () => {
    fc.assert(
      fc.property(fc.constantFrom(...EMERGENCY_POSITIVE), noise, noise, fc.boolean(), (phrase, a, b, upper) =>
        isEmergency([...a, caseOf(phrase, upper), ...b].join(" ")),
      ),
    );
  });

  it("curly and straight apostrophes match the same way", () => {
    for (const p of EMERGENCY_POSITIVE) expect(isEmergency(p.replace(/'/g, "’"))).toBe(isEmergency(p.replace(/’/g, "'")));
  });

  it("no negative phrase becomes an emergency from friendly words around it", () => {
    fc.assert(fc.property(fc.constantFrom(...EMERGENCY_NEGATIVE), noise, (phrase, a) => !isEmergency([...a, phrase].join(" "))));
  });
});

describe("firstName (property)", () => {
  it("is the first word of the trimmed name, with no space, and empty for a blank name", () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        const first = firstName(name);
        expect(first).not.toMatch(/\s/u);
        expect(name.trim().startsWith(first)).toBe(true);
      }),
    );
    expect(firstName("   ")).toBe("");
    expect(firstName("  Neha  Sharma ")).toBe("Neha");
  });
});
