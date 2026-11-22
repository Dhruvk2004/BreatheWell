import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { tokeniseQuestion, type NamedPerson } from "@/domain/breezy/names";
import { devanagariToLatin, sameNameAcrossScripts, soundKey } from "@/domain/names/translit";

/** A stored name typed in the other script still becomes its token (review H3, spec 7.7.9). */
const PEOPLE: readonly NamedPerson[] = [
  { id: "neha", kind: "adult", token: "m1", names: ["Neha"] },
  { id: "riya", kind: "dependent", token: "d2", names: ["Riya"] },
  { id: "priya", kind: "adult", token: "m4", names: ["प्रिया"] },
];

describe("names across scripts", () => {
  it.each([
    ["रिया को कब खेलना चाहिए?", "{d2} को कब खेलना चाहिए?"],
    ["… NEHA ji, नेहा", "… {m1} ji, {m1}"],
    ["नेहा और रिया पार्क जाएँ?", "{m1} और {d2} पार्क जाएँ?"],
    ["Can Priya walk at 3 pm?", "Can {m4} walk at 3 pm?"],
  ])("%s → %s", (question, text) => expect(tokeniseQuestion(question, PEOPLE, {}).text).toBe(text));

  it("leaves ordinary Hindi words alone", () => {
    for (const q of ["क्या आज खिड़की खोलें?", "नहीं, नहा कर आओ", "आज सैर कब करूँ?"]) expect(tokeniseQuestion(q, PEOPLE, {}).text).toBe(q);
  });

  it("reads Devanagari letter by letter and gives both spellings one key", () => {
    expect(devanagariToLatin("रिया")).toBe("riyaa");
    expect(devanagariToLatin("प्रिया")).toBe("priyaa");
    expect(devanagariToLatin("ज़ोया")).toBe("joyaa");
    expect(devanagariToLatin("संजय")).toBe("sanjay");
    for (const [latin, hindi] of [
      ["Kavya", "काव्या"],
      ["Ishaan", "ईशान"],
      ["Siddharth", "सिद्धार्थ"],
      ["Kamla", "कमला"],
      ["Chhavi", "छवि"],
      ["Aarav", "आरव"],
    ])
      expect(soundKey(latin)).toBe(soundKey(hindi));
  });

  it("only matches across scripts, and never a one-letter key", () => {
    expect(sameNameAcrossScripts("Neha", "Neha")).toBe(false);
    expect(sameNameAcrossScripts("अ", "a")).toBe(false);
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), (word) => {
        expect(typeof soundKey(word)).toBe("string");
        expect(sameNameAcrossScripts(word, word)).toBe(false);
      }),
    );
  });
});
