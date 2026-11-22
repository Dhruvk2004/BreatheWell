import { describe, expect, it } from "vitest";
import { clauses, isCancelled } from "@/ai/shared/skip";
import { findTimes } from "@/ai/shared/times";

/** Is the time at `index` in the clause cancelled by a skip phrase? */
const cancelled = (clause: string, index = 0) => isCancelled(clause, findTimes(clause)[index]);

describe("skip phrases govern a time only when they point at it (spec 7.1)", () => {
  it("splits sentences into clauses on commas, semicolons, colons and spaced dashes, not inside times", () => {
    expect(clauses("Walk at 6:30 am, no rush; really: yes – ok")).toEqual(["Walk at 6:30 am", "no rush", "really", "yes", "ok"]);
    expect(clauses("Best 2–4 pm")).toEqual(["Best 2–4 pm"]);
  });

  it.each([
    "skip the 6:30 am walk",
    "instead of your usual 6:30 am",
    "not outside at 6:30 am",
    "don't go out at 6:30 am",
    "avoid going out at 6:30 am",
    "सुबह 6:30 बजे की सैर छोड़ें",
    "सुबह 6:30 बजे के बजाय",
    "सुबह 6:30 बजे नहीं",
    "सुबह 6:30 बजे बाहर मत जाओ",
    "सुबह 6:30 बजे की सैर न करें",
  ])("cancels: %s", (clause) => expect(cancelled(clause)).toBe(true));

  it.each([
    "enjoy your 6:30 am walk",
    "walk at 6:30 am no worries",
    "it is not too bad to walk at 6:30 am",
    "don't worry and walk at 6:30 am",
    "do not wait, just go and walk with friends at 6:30 am",
    "सुबह 6:30 बजे टहलना बुरा नहीं है",
    "सुबह 6:30 बजे टहलें चिंता न करें",
  ])("does not cancel: %s", (clause) => expect(cancelled(clause)).toBe(false));

  it("stops at another time: the phrase governs the nearer one", () => {
    expect(cancelled("skip 3 pm and walk at 6:30 am", 1)).toBe(false);
    expect(cancelled("skip 3 pm and walk at 6:30 am", 0)).toBe(true);
    expect(cancelled("सुबह 6:30 बजे और दोपहर 3 बजे की सैर छोड़ें", 0)).toBe(false);
    expect(cancelled("सुबह 6:30 बजे और दोपहर 3 बजे की सैर छोड़ें", 1)).toBe(true);
  });
});

describe("Hindi times end at a word boundary", () => {
  it("does not read बजेगा as a time", () => expect(findTimes("3 बजेगा")).toEqual([]));
});
