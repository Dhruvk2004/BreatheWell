import { describe, expect, it } from "vitest";
import { storedBreezyAnswers, storedBreezyFor, storedBreezyKey } from "@/data/demo/storedBreezy";
import { breezyCard } from "@/domain/breezy/answer";
import { passesKidChecks } from "@/domain/libraries/kid";
import { DEMO_CHIPS, demoChips, loadBreezyDemo } from "@/server/demo/demoBreezy";
import { parkAnswer, templeAnswer } from "@/server/demo/demoAnswers";
import { recordedDemo } from "@/server/demo/demoPage";

/** Breezy demo mode (spec 7.7.2): chips only, stored answers or the code's Simple answer, nothing written. */
describe("Breezy demo", () => {
  it("answers every chip in both languages from code while nothing is stored", () => {
    for (const lang of ["en", "hi"] as const) {
      const page = loadBreezyDemo({ scenario: "smog-morning", time: 6, view: "neha" }, lang);
      expect(page.chips.map((c) => c.id)).toEqual([...DEMO_CHIPS]);
      for (const chip of page.chips) {
        expect(chip.source).toBe("template");
        expect(chip.text.length).toBeGreaterThan(0);
        expect(chip.text).not.toMatch(/cigarette|सिगरेट/i);
      }
      expect(page.people.map((p) => p.id)).toEqual(["neha", "rahul", "dadaji", "aarav", "riya"]);
    }
  });

  it("plans Dadaji's temple visit at the rules' best hour, with the rule's chip", () => {
    const answer = templeAnswer(recordedDemo("smog-morning", 6, "neha"), "en");
    expect(answer.text).toBe("The best time for Dadaji's temple visit is 3 pm today.");
    expect(answer.cards).toEqual([expect.objectContaining({ forId: "dadaji", time: "15:00", verdict: "go", action: "add_to_plan" })]);
    expect(breezyCard.safeParse(answer.cards[0]).success).toBe(true);
    expect(passesKidChecks(answer.cards[0].item.en)).toBe(true);
  });

  it("says the temple can wait on a Severe day, and finds the park day from the outlook", () => {
    const severe = recordedDemo("severe-day", 6, "neha");
    expect(templeAnswer(severe, "hi")).toEqual({ text: expect.stringContaining("दादाजी"), cards: [] });
    expect(parkAnswer(recordedDemo("smog-morning", 6, "neha"), "en").text).toMatch(/^In the next days, \w+ looks best for the park: /);
    const noWindows = { ...severe, day: { ...severe.day, summary: { ...severe.day.summary, outlook: [] } } };
    expect(parkAnswer(noWindows, "en").text).toBe("No day in the next 5 days has a clean window for the park.");
  });

  it("uses Smog morning for Live today, whose answers are never stored", () => {
    const page = loadBreezyDemo({ scenario: "live", time: 6, view: "neha" }, "en");
    expect(page.updated).toBe("6:10 am");
  });

  it("answers Riya's play from her plan and covers a missing person", () => {
    const data = recordedDemo("smog-morning", 6, "neha");
    const chips = demoChips({ scenario: "smog-morning", time: 6, view: "neha" }, data, "en");
    expect(chips.find((c) => c.id === "riyaPlay")?.text).toMatch(/^Riya's play: /);
    const empty = { ...data, day: { ...data.day, rows: [] } };
    expect(demoChips({ scenario: "smog-morning", time: 6, view: "neha" }, empty, "en").find((c) => c.id === "riyaPlay")?.text).toContain(
      "no air reading",
    );
  });

  it("stores answers by scenario, chip and language; every stored answer is well formed", () => {
    expect(storedBreezyKey("smog-morning", "temple", "hi")).toBe("smog-morning:temple:hi");
    expect(storedBreezyFor("nothing:here:en")).toBeNull();
    for (const [, entry] of storedBreezyAnswers()) {
      expect(entry.text).not.toMatch(/cigarette|सिगरेट|AQI/i);
      for (const c of entry.cards) expect(c.verdict).not.toBe("avoid");
    }
  });
});
