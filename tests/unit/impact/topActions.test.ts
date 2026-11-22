import { describe, expect, it, vi } from "vitest";
import { factById } from "@/domain/impact/facts";
import { EXAMPLE_DAY_PM25, TOP_ACTION_IDS, topActions } from "@/domain/impact/topActions";

describe("Learn's top actions (spec 10.11 item 2)", () => {
  it("lists every action once, ranked 1–5, each backed by a library fact", () => {
    const list = topActions();
    expect(list.map((a) => a.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(list.map((a) => a.id))).toEqual(new Set(TOP_ACTION_IDS));
    for (const a of list) expect(factById(a.factId)).toBeDefined();
    expect(list[0]).toMatchObject({ id: "clean", factId: "afternoon_mixing" });
    expect(topActions(2).map((a) => a.id)).toEqual(["clean", "room"]);
    expect(EXAMPLE_DAY_PM25).toBeGreaterThan(90);
  });

  it("drops an action whose fact has left the library", async () => {
    vi.resetModules();
    vi.doMock("@/domain/impact/facts", () => ({ factById: (id: string) => (id === "n95_fit" ? undefined : { id }) }));
    const { topActions: fresh } = await import("@/domain/impact/topActions");
    expect(fresh().map((a) => a.id)).not.toContain("n95");
    vi.doUnmock("@/domain/impact/facts");
  });
});
