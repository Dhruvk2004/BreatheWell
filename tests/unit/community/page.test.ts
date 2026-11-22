import { describe, expect, it, vi } from "vitest";
import { communityGet } from "@/server/handlers/community";
import { loadCommunityPage, type CommunityDeps } from "@/server/community/page";
import { RateLimiter } from "@/server/rateLimit";
import { airOf, bandDay, daySeries, joinSeries } from "../../helpers/air";
import { deps as airDeps, NOW } from "../../helpers/airDeps";
import { MemoryDb } from "../../helpers/memoryDb";
import { fakeModel } from "../../helpers/planReply";

/** `/community` and `GET /api/community` (spec 7.6, 10.13): code header and footer, Gemini middle, template fallback. */
const WORDS = {
  en: {
    title: "Smog morning",
    body: "Good morning, everyone. Keep morning walks indoors today.",
    together: "no leaf burning in our society.",
  },
  hi: { title: "आज धुंध है", body: "सुप्रभात। आज सुबह की सैर घर के अंदर करें।", together: "सोसाइटी में पत्ते न जलाएँ।" },
};
const GREEN_PARK = { place: "Green Park, New Delhi", lat: "28.56", lon: "77.21" };

function deps(over: Partial<CommunityDeps> = {}): CommunityDeps & { model: ReturnType<typeof fakeModel> } {
  const model = fakeModel(() => JSON.stringify(WORDS));
  return {
    db: new MemoryDb(),
    gemini: model,
    now: () => NOW,
    log: vi.fn(),
    air: airDeps(),
    limiter: new RateLimiter(20, 3_600_000),
    model,
    ...over,
  };
}
const headers = new Headers({ "x-forwarded-for": "198.51.100.7" });

describe("loadCommunityPage", () => {
  it("writes the header and footer from code and the middle from Gemini, in both languages", async () => {
    const page = await loadCommunityPage(GREEN_PARK, headers, deps());
    if (page.kind !== "ready") throw new Error(page.kind);
    expect(page).toMatchObject({ source: "gemini", band: "very_poor", place: "Green Park, New Delhi" });
    expect(page.messages.en.header).toMatch(/^Air in Green Park, New Delhi today: Very poor \(24-h average ≈ \d+\)/);
    expect(page.messages.en.together).toBe("Together today: no leaf burning in our society.");
    expect(page.messages.hi.together).toBe("आज मिलकर: सोसाइटी में पत्ते न जलाएँ।");
    expect(page.messages.en.footer).toContain("Open-Meteo model data");
    expect(JSON.stringify(page)).not.toMatch(/cigarette|सिगरेट/i);
  });

  it("never sends the URL's place name to Gemini", async () => {
    const d = deps();
    await loadCommunityPage({ ...GREEN_PARK, place: "Mrs Kapoor's society" }, headers, d);
    expect(d.model.calls[0].prompt).not.toContain("Kapoor");
  });

  it("uses the template (Simple message) outside listed cities, unless it is the viewer's family home", async () => {
    const far = { place: "Somewhere", lat: "10.0", lon: "70.0" };
    const d = deps();
    expect(await loadCommunityPage(far, headers, d)).toMatchObject({
      kind: "ready",
      source: "template",
      messages: { en: { title: null } },
    });
    expect(d.model.calls).toHaveLength(0);
    expect(await loadCommunityPage(far, headers, d, "10.0_70.0")).toMatchObject({ source: "gemini" });
  });

  it("names the place by its coordinates when the URL has no name", async () => {
    expect(await loadCommunityPage({ lat: "28.56", lon: "77.21" }, headers, deps())).toMatchObject({ place: "Near 28.56, 77.21" });
  });

  it("answers no_place, rate_limited and unavailable", async () => {
    expect(await loadCommunityPage({}, headers, deps())).toEqual({ kind: "no_place" });
    const once = deps({ limiter: new RateLimiter(1, 60_000, () => NOW.getTime()) });
    await loadCommunityPage(GREEN_PARK, headers, once);
    expect(await loadCommunityPage(GREEN_PARK, headers, once)).toEqual({ kind: "rate_limited" });
    const noAir = deps({ air: airDeps({ fetchAir: vi.fn(async () => ({ ok: false as const, error: "network" as const })) }) });
    expect(await loadCommunityPage(GREEN_PARK, headers, noAir)).toEqual({ kind: "unavailable", place: "Green Park, New Delhi" });
  });
});

describe("GET /api/community", () => {
  const get = (query: string, d: CommunityDeps = deps()) =>
    communityGet(new Request(`https://app.test/api/community?${query}`, { headers }), d);

  it("returns the public message with a CDN cache header", async () => {
    const response = await get("lat=28.56&lon=77.21&place=Green+Park");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=600");
  });

  it("maps the other states to 400, 429 and 503", async () => {
    expect((await get("lat=x")).status).toBe(400);
    const once = deps({ limiter: new RateLimiter(1, 60_000, () => NOW.getTime()) });
    await get("lat=28.56&lon=77.21", once);
    expect((await get("lat=28.56&lon=77.21", once)).status).toBe(429);
    const noAir = deps({ air: airDeps({ fetchAir: vi.fn(async () => ({ ok: false as const, error: "network" as const })) }) });
    expect((await get("lat=28.56&lon=77.21", noAir)).status).toBe(503);
  });

  it("sends the best and worst windows when the day has them, and lets the body name the best hour only", async () => {
    const day = joinSeries(
      bandDay("2024-11-17", "poor"),
      bandDay("2024-11-18", "very_poor", { 14: "moderate", 15: "moderate", 16: "moderate", 7: "severe", 8: "severe" }),
    );
    const air = airDeps({ fetchAir: vi.fn(async () => ({ ok: true as const, value: { air: airOf(day), timeZone: "Asia/Kolkata" } })) });
    const d = deps({ air });
    const page = await loadCommunityPage(GREEN_PARK, headers, d);
    expect(page.kind).toBe("ready");
    const prompt = d.model.calls[0]?.prompt ?? "";
    expect(prompt).toMatch(/"bestWindow":"\d{2}:00-\d{2}:00"/);
    expect(prompt).toMatch(/"worstWindow":"\d{2}:00-\d{2}:00"/);
  });

  it("sends no windows without enough forecast hours", async () => {
    const day = joinSeries(
      bandDay("2024-11-17", "poor"),
      daySeries(
        "2024-11-18",
        Array.from({ length: 24 }, (_, h) => (h < 8 ? 200 : null)),
      ),
    );
    const air = airDeps({ fetchAir: vi.fn(async () => ({ ok: true as const, value: { air: airOf(day), timeZone: "Asia/Kolkata" } })) });
    const d = deps({ air });
    expect((await loadCommunityPage(GREEN_PARK, headers, d)).kind).toBe("ready");
    expect(d.model.calls[0]?.prompt).toContain('"bestWindow":null');
  });
});
