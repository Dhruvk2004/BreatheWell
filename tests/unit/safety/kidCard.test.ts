import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BANDS } from "@/domain/air/bands";
import { kidCardFor } from "@/domain/family/kidCardFor";
import { kidCardProblems, kidShareText } from "@/domain/libraries/kid";
import { recordedDemo } from "@/server/demo/demoPage";

/**
 * The kid card (spec 7.2, 10.12): no numbers but clock times, no air units, no cigarettes, fear or
 * health words, for every band, hour, language and dependent; and the check itself, as properties.
 */
const strings = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];

describe("kid card text for every band, hour and language", () => {
  const dependents = (["smog-morning", "severe-day"] as const).flatMap((s) =>
    ([6, 12, 16] as const).flatMap((hour) =>
      recordedDemo(s, hour, "neha")
        .day.rows.filter((r) => r.person.kind === "dependent")
        .map((row) => ({ row, hour })),
    ),
  );

  it("every line and the share text pass the kid-card checks", () => {
    expect(dependents.length).toBeGreaterThan(0);
    for (const { row, hour } of dependents)
      for (const band of BANDS)
        for (const lang of ["en", "hi"] as const) {
          const card = kidCardFor(row, band, lang, hour, "2024-11-18");
          for (const text of [...strings(card), kidShareText("Riya", band, card, lang).replace(/^Riya|^रिया/u, "")])
            expect(kidCardProblems(text), `${band} ${hour} ${lang}: ${text}`).toEqual([]);
        }
  });
});

describe("kid-card checks (properties)", () => {
  const word = fc.constantFrom("masks", "minutes", "games", "times", "laps", "मास्क", "बार");

  it("any count that is not a clock time is flagged, in Latin or Devanagari digits", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 999 }), word, (n, w) => kidCardProblems(`Take ${n} ${w}`).includes("digits")));
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), (n) => kidCardProblems(`${n.toLocaleString("hi-IN-u-nu-deva")} बार`).includes("digits")),
    );
  });

  it("a clock time alone is fine, in both languages", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom("am", "pm"),
        (h, m) => kidCardProblems(`Play outside at ${h} ${m}`).length === 0,
      ),
    );
    fc.assert(fc.property(fc.integer({ min: 1, max: 12 }), (h) => kidCardProblems(`दोपहर ${h} बजे खेलो`).length === 0));
  });

  it("cigarette, fear and health words are flagged in any case and position", () => {
    const banned = fc.constantFrom(
      ["cigarette", "cigarette"],
      ["SMOKING", "cigarette"],
      ["सिगरेट", "cigarette"],
      ["bidi", "cigarette"],
      ["Poison", "fear"],
      ["कैंसर", "fear"],
      ["Inhaler", "health"],
      ["दवा", "health"],
    );
    fc.assert(
      fc.property(banned, fc.constantFrom("", "Today ", "आज "), fc.constantFrom("", " now.", " है।"), ([w, problem], a, b) =>
        kidCardProblems(`${a}${w}${b}`).includes(problem as never),
      ),
    );
  });
});
