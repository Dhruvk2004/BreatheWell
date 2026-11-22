import { describe, expect, it, vi } from "vitest";
import { kidCardProblems } from "@/domain/libraries/kid";
import { parseDemoQuery } from "@/data/demo/query";
import { loadDemo, recordedDemo } from "@/server/demo/demoPage";
import { loadKidPage } from "@/server/demo/kidPage";
import { deps } from "../../helpers/airDeps";

const down = () => deps({ fetchAir: vi.fn(async () => ({ ok: false as const, error: "timeout" as const })) });

describe("demo query (spec 10.3)", () => {
  it("reads the scenario, stepper time and viewer, falling back to Smog morning, 6 am, Neha", () => {
    expect(parseDemoQuery({ scenario: "severe-day", time: "16", view: "dadaji" })).toEqual({
      scenario: "severe-day",
      time: 16,
      view: "dadaji",
    });
    expect(parseDemoQuery({ scenario: ["live"], time: ["12"] })).toEqual({ scenario: "live", time: 12, view: "neha" });
    expect(parseDemoQuery({ scenario: "x", time: "7", view: "riya" })).toEqual({ scenario: "smog-morning", time: 6, view: "neha" });
  });
});

describe("loadDemo", () => {
  it("runs a recorded day on the scenario clock moved by the stepper", () => {
    const at4 = recordedDemo("smog-morning", 16, "neha");
    expect(at4.source).toBe("recorded");
    expect(at4.recordedDate).toBe("2024-11-18");
    expect(at4.day.summary.hour).toBe(16);
    expect(at4.day.freshness).toBe("fresh");
    expect(at4.day.rows[0].person.id).toBe("neha");
  });

  it("Live today uses live air with the real clock, or the saved 20 Nov snapshot when Open-Meteo is down", async () => {
    const live = await loadDemo({ scenario: "live", time: 6, view: "dadaji" }, deps());
    expect(live.source).toBe("live");
    expect(live.recordedDate).toBeNull();
    expect(live.day.rows[0].person.id).toBe("dadaji");
    const fallback = await loadDemo({ scenario: "live", time: 6, view: "neha" }, down());
    expect(fallback).toMatchObject({ source: "fallback", recordedDate: "2026-11-20" });
    expect(fallback.day.rows.length).toBe(5);
  });
});

describe("demo kid cards (spec 10.12) 🔒", () => {
  it("builds Riya's card with no numbers but clock times and a share text", async () => {
    const kid = await loadKidPage("riya", { scenario: "smog-morning", time: 6, view: "neha" }, "en", deps());
    if (!kid) throw new Error("no card");
    expect(kid.band).toBe("very_poor");
    expect(kid.card.headline).toBe("The air is very unhealthy this morning");
    expect(kid.shareText).toMatch(/^Riya's air card for today 🔴/);
    expect(kidCardProblems(kid.shareText)).toEqual([]);
  });

  it("writes Aarav's teen card in Hindi", async () => {
    const kid = await loadKidPage("aarav", { scenario: "severe-day", time: 6, view: "neha" }, "hi", deps());
    expect(kid?.shareText).toMatch(/^आरव का आज का हवा कार्ड/);
  });

  it("has no card for an adult, an unknown id, or a day without air data", async () => {
    const query = { scenario: "smog-morning" as const, time: 6 as const, view: "neha" as const };
    expect(await loadKidPage("dadaji", query, "en", deps())).toBeNull();
    expect(await loadKidPage("nobody", query, "en", deps())).toBeNull();
    const empty = deps({
      fetchAir: vi.fn(async () => ({
        ok: true as const,
        value: { air: { time: [], pm25: [], pm10: [], no2: [], o3: [], co: [], so2: [] }, timeZone: "Asia/Kolkata" },
      })),
    });
    expect(await loadKidPage("riya", { ...query, scenario: "live" }, "en", empty)).toBeNull();
  });
});
