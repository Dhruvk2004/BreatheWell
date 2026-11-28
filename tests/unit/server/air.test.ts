import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/server/cache";
import { ANONYMOUS_FACTOR, checkClient, clientKey, RateLimiter } from "@/server/rateLimit";
import { parsePlaceQuery, safePlaceName } from "@/server/air/query";
import { loadAir } from "@/server/air/service";
import { cacheDocId, fromCacheDoc, gridCentre, hourKey, toCacheDoc, type AirSnapshot } from "@/server/air/snapshot";
import type { AirStore } from "@/server/air/store";
import { deps, NOW, snapshot } from "../../helpers/airDeps";

const memoryStore = (): AirStore & { docs: Map<string, AirSnapshot> } => {
  const docs = new Map<string, AirSnapshot>();
  return {
    docs,
    get: vi.fn(async (gridId: string, at: Date) => docs.get(cacheDocId(gridId, at)) ?? null),
    put: vi.fn(async (s: AirSnapshot) => void docs.set(cacheDocId(s.gridId, s.fetchedAt), s)),
  };
};

describe("in-memory helpers", () => {
  it("TtlCache expires entries and evicts the least recently used", () => {
    let now = 0;
    const cache = new TtlCache<number>(2, 100, () => now);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    now = 200;
    expect(cache.get("a")).toBeUndefined();
  });

  it("RateLimiter allows the limit per window, then says when to retry", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 60_000, () => now);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k")).toEqual({ allowed: false, retryAfterSeconds: 60 });
    now = 60_000;
    expect(limiter.check("k").allowed).toBe(true);
  });

  it("RateLimiter prunes expired windows once it holds many keys", () => {
    let now = 0;
    const limiter = new RateLimiter(1, 10, () => now);
    for (let i = 0; i < 5001; i++) limiter.check(`k${i}`);
    now = 20;
    expect(limiter.check("fresh").allowed).toBe(true);
  });

  it("clientKey hashes the rightmost forwarded hop, never keeping the IP", () => {
    const a = clientKey(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }));
    expect(a).toBe(clientKey(new Headers({ "x-forwarded-for": "203.0.113.9" })));
    expect(a).not.toContain("203");
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe(a);
    expect(clientKey(new Headers())).toBeNull();
    expect(clientKey(new Headers({ "x-forwarded-for": " , " }))).toBeNull();
  });

  it("requests without an address share one larger bucket and the server says so once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const limiter = new RateLimiter(2, 1000);
    const none = new Headers();
    for (let i = 0; i < 2 * ANONYMOUS_FACTOR; i++) expect(checkClient(limiter, none).allowed).toBe(true);
    expect(checkClient(limiter, none).allowed).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    const ip = new Headers({ "x-forwarded-for": "203.0.113.9" });
    expect(checkClient(limiter, ip).allowed).toBe(true);
    expect(checkClient(limiter, ip).allowed).toBe(true);
    expect(checkClient(limiter, ip).allowed).toBe(false);
    warn.mockRestore();
  });
});

describe("place query", () => {
  it("accepts rounded coordinates, a place name and a country code", () => {
    expect(parsePlaceQuery({ lat: "18.52", lon: "73.86", place: " Pune ", cc: "IN" })).toEqual({
      lat: 18.52,
      lon: 73.86,
      place: "Pune",
      cc: "IN",
    });
    expect(parsePlaceQuery({ lat: ["28.56", "1"], lon: "77.21" })).toEqual({ lat: 28.56, lon: 77.21 });
  });

  it("keeps plain place names in any script and drops spoofable text", () => {
    for (const ok of ["Green Park, New Delhi", "नई दिल्ली", "St. John's Wood", "Sector 62 (Noida)"]) expect(safePlaceName(ok)).toBe(ok);
    for (const bad of ["Win a prize at evil.example", "<b>hi</b>", "https://x.in", "Call +91 99999", ""])
      expect(safePlaceName(bad)).toBeUndefined();
    expect(parsePlaceQuery({ lat: "28.56", lon: "77.21", place: "Win a prize at evil.example" })).toEqual({ lat: 28.56, lon: 77.21 });
  });

  it.each([
    {},
    { lat: "x", lon: "1" },
    { lat: "91", lon: "1" },
    { lat: "1", lon: "1", cc: "IND" },
    { lat: "1", lon: "1", place: "x".repeat(81) },
  ])("refuses %j", (q) => {
    expect(parsePlaceQuery(q)).toBeNull();
  });
});

describe("airCache document", () => {
  it("keys by grid and UTC hour and round-trips through the stored shape", () => {
    expect(hourKey(NOW)).toBe("2024111800");
    expect(cacheDocId("28.6_77.2", NOW)).toBe("28.6_77.2_2024111800");
    expect(gridCentre("-12.3_45.6")).toEqual({ lat: -12.3, lon: 45.6 });
    const doc = toCacheDoc(snapshot());
    expect(doc.expireAt.getTime() - NOW.getTime()).toBe(48 * 3_600_000);
    expect(doc.nowAqi).not.toBeNull();
    expect(doc.bands).toHaveLength(24);
    expect(fromCacheDoc(doc)).toEqual(snapshot());
    expect(fromCacheDoc({ gridId: "x" })).toBeNull();
  });

  it("stores nulls when the clock's hour has no data", () => {
    const doc = toCacheDoc(snapshot({ fetchedAt: new Date("2030-01-01T00:00:00Z") }));
    expect(doc).toMatchObject({ nowAqi: null, avg24Aqi: null, mainPollutant: null, outlook: [] });
  });
});

describe("loadAir: memory → Firestore → Open-Meteo", () => {
  it("fetches once per grid cell per hour and writes the cache", async () => {
    const store = memoryStore();
    const d = deps({ store });
    const first = await loadAir({ lat: 28.56, lon: 77.21 }, d);
    expect(first?.gridId).toBe("28.6_77.2");
    expect(d.fetchAir).toHaveBeenCalledWith({ lat: 28.6, lon: 77.2 });
    expect(store.put).toHaveBeenCalledOnce();
    await loadAir({ lat: 28.61, lon: 77.24 }, d);
    expect(d.fetchAir).toHaveBeenCalledOnce();
  });

  it("serves another instance's Firestore copy without fetching", async () => {
    const store = memoryStore();
    store.docs.set(cacheDocId("28.6_77.2", NOW), snapshot());
    const d = deps({ store });
    expect(await loadAir({ lat: 28.6, lon: 77.2 }, d)).toEqual(snapshot());
    expect(d.fetchAir).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });

  it("carries on when Firestore fails, and keeps going without weather", async () => {
    const store: AirStore = { get: vi.fn().mockRejectedValue(new Error("down")), put: vi.fn().mockRejectedValue(new Error("quota")) };
    const d = deps({ store, fetchWeather: vi.fn(async () => ({ ok: false as const, error: "timeout" as const })) });
    const s = await loadAir({ lat: 28.6, lon: 77.2 }, d);
    expect(s?.weather.time).toEqual([]);
    // Not cached for the hour: the next request tries the weather again, and stores the full snapshot.
    expect(store.put).not.toHaveBeenCalled();
    await loadAir({ lat: 28.6, lon: 77.2 }, d);
    expect(d.fetchWeather).toHaveBeenCalledTimes(2);
  });

  it("falls back to the last good snapshot, else null, when Open-Meteo fails", async () => {
    const failing = vi.fn(async () => ({ ok: false as const, error: "http" as const }));
    const d = deps({ fetchAir: failing });
    expect(await loadAir({ lat: 28.6, lon: 77.2 }, d)).toBeNull();
    d.lastGood.set("28.6_77.2", snapshot());
    expect(await loadAir({ lat: 28.6, lon: 77.2 }, d)).toEqual(snapshot());
  });
});
