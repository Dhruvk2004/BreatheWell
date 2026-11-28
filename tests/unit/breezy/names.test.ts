import { describe, expect, it } from "vitest";
import { aliasTarget, aliasValue, tokeniseQuestion, type NamedPerson } from "@/domain/breezy/names";

/** Names and aliases: kin words, aliases and stored names in Latin and Devanagari. */
const SHARMAS: readonly NamedPerson[] = [
  { id: "neha", kind: "adult", token: "m1", names: ["Neha"] },
  { id: "rahul", kind: "adult", token: "m2", names: ["Rahul"] },
  { id: "ramesh", kind: "adult", token: "m3", names: ["Dadaji"] },
  { id: "riya", kind: "dependent", token: "d1", names: ["Riya"] },
];

describe("tokeniseQuestion", () => {
  it("asks first about a kin word with no alias, and changes nothing else", () => {
    expect(tokeniseQuestion("Papa wants to go to the temple at 7 am", SHARMAS, {})).toEqual({
      text: "Papa wants to go to the temple at 7 am",
      unmapped: ["papa"],
    });
  });

  it("resolves Papa once mapped, in Latin and Devanagari", () => {
    const aliases = { papa: "ramesh" };
    expect(tokeniseQuestion("Can Papa walk at 3?", SHARMAS, aliases)).toEqual({ text: "Can {m3} walk at 3?", unmapped: [] });
    expect(tokeniseQuestion("पापा कब टहलें?", SHARMAS, aliases).text).toBe("{m3} कब टहलें?");
  });

  it("lets two viewers map Papa to different people", () => {
    expect(tokeniseQuestion("papa", SHARMAS, { papa: "ramesh" }).text).toBe("{m3}");
    expect(tokeniseQuestion("papa", SHARMAS, { papa: "rahul" }).text).toBe("{m2}");
  });

  it("matches दादाजी, Dadaji and dadaji to the same stored name", () => {
    for (const q of ["Dadaji ko walk kab karni chahiye", "dadaji ko walk kab karni chahiye", "दादाजी को सैर कब करनी चाहिए"])
      expect(tokeniseQuestion(q, SHARMAS, {})).toMatchObject({ unmapped: [] });
    expect(tokeniseQuestion("dadaji walk", SHARMAS, {}).text).toBe("{m3} walk");
  });

  it("resolves an alias to a dependent's token, and swaps stored names", () => {
    expect(tokeniseQuestion("Gudiya and Neha", SHARMAS, { gudiya: "dep:riya" }).text).toBe("{d1} and {m1}");
  });

  it("ignores an alias that points outside the family", () => {
    expect(tokeniseQuestion("Papa?", SHARMAS, { papa: "someone-removed" }).unmapped).toEqual(["papa"]);
  });

  it("stores dependents as dep:<id>", () => {
    expect(aliasValue({ id: "riya", kind: "dependent" })).toBe("dep:riya");
    expect(aliasValue({ id: "ramesh", kind: "adult" })).toBe("ramesh");
    expect(aliasTarget("dep:riya")).toBe("riya");
    expect(aliasTarget("ramesh")).toBe("ramesh");
  });
});
