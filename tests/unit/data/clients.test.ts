import { describe, expect, it, vi } from "vitest";
import { reverseGeocode, reverseUrl, toPlaceName } from "@/data/bigDataCloud";
import { fetchJson, query, type FetchLike } from "@/data/http";
import { airQualityUrl, fetchAirQuality, fetchWeather, weatherUrl } from "@/data/openMeteo/air";
import { geocodeUrl, searchPlaces, suggestionLabel } from "@/data/openMeteo/geocode";
import { airQualityResponse } from "@/data/openMeteo/schemas";
import air from "../../fixtures/api/air-delhi.json";
import pune from "../../fixtures/api/geocode-pune.json";
import reverse from "../../fixtures/api/reverse-delhi.json";
import weather from "../../fixtures/api/weather-delhi.json";

/** A fetch double that replays a recorded body and records the URL. */
function replay(body: unknown, status = 200) {
  const urls: string[] = [];
  const fetch: FetchLike = async (url) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch, urls };
}

const GREEN_PARK = { lat: 28.5612, lon: 77.2087 };

describe("Open-Meteo air and weather (recorded 20 Nov 2026)", () => {
  it("asks for hourly pollutants, yesterday plus 5 days, with rounded coordinates", () => {
    const url = new URL(airQualityUrl(GREEN_PARK));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      latitude: "28.56",
      longitude: "77.21",
      past_days: "1",
      forecast_days: "5",
      timezone: "auto",
    });
    expect(url.searchParams.get("hourly")).toContain("pm2_5");
    expect(new URL(weatherUrl(GREEN_PARK)).searchParams.get("wind_speed_unit")).toBe("kmh");
    expect(airQualityUrl(GREEN_PARK, "http://localhost:3101")).toMatch(/^http:\/\/localhost:3101\/v1\/air-quality\?latitude=28\.56/);
    expect(weatherUrl(GREEN_PARK, "http://localhost:3101/fail")).toMatch(/^http:\/\/localhost:3101\/fail\/v1\/forecast\?/);
  });

  it("parses the recorded air response into the domain's series", async () => {
    const { fetch, urls } = replay(air);
    const result = await fetchAirQuality(GREEN_PARK, { fetch });
    expect(urls).toHaveLength(1);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.timeZone).toBe("Asia/Kolkata");
    expect(result.value.air.time.length).toBe(air.hourly.time.length);
    expect(result.value.air.pm25[0]).toBe(air.hourly.pm2_5[0]);
    expect(result.value.air.co.length).toBe(result.value.air.time.length);
  });

  it("parses the recorded weather response", async () => {
    const result = await fetchWeather(GREEN_PARK, replay(weather));
    if (!result.ok) throw new Error(result.error);
    expect(result.value.windKmh[0]).toBe(weather.hourly.wind_speed_10m[0]);
  });

  it("rejects a response whose series do not match the time axis", () => {
    const broken = { ...air, hourly: { ...air.hourly, pm10: [1, 2] } };
    expect(airQualityResponse.safeParse(broken).success).toBe(false);
  });

  it("passes failures through", async () => {
    expect(await fetchAirQuality(GREEN_PARK, replay({}, 503))).toEqual({ ok: false, error: "http" });
    expect(await fetchWeather(GREEN_PARK, replay({ nope: true }))).toEqual({ ok: false, error: "invalid" });
  });
});

describe("fetchJson outcomes", () => {
  const schema = airQualityResponse;

  it("tells timeouts from network errors and bad JSON from bad shapes", async () => {
    const timeout: FetchLike = () => Promise.reject(new DOMException("slow", "TimeoutError"));
    const offline: FetchLike = () => Promise.reject(new TypeError("fetch failed"));
    const notJson: FetchLike = async () => new Response("<html>", { status: 200 });
    expect(await fetchJson("https://x.test", schema, { fetch: timeout })).toEqual({ ok: false, error: "timeout" });
    expect(await fetchJson("https://x.test", schema, { fetch: offline })).toEqual({ ok: false, error: "network" });
    expect(await fetchJson("https://x.test", schema, { fetch: notJson })).toEqual({ ok: false, error: "invalid" });
  });

  it("sends an abort signal and the Next.js cache hint", async () => {
    const spy = vi.fn<FetchLike>(async () => new Response(JSON.stringify(air)));
    await fetchJson("https://x.test", schema, { fetch: spy, next: { revalidate: 60 } });
    const init = spy.mock.calls[0][1] as RequestInit & { next?: unknown };
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.next).toEqual({ revalidate: 60 });
  });

  it("uses the global fetch by default and builds query strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(air))),
    );
    expect((await fetchJson("https://x.test", schema)).ok).toBe(true);
    expect(query({ a: 1, b: undefined, c: "x y" })).toBe("a=1&c=x+y");
  });
});

describe("city search (Open-Meteo geocoding)", () => {
  it("returns suggestions from the recorded Pune search", async () => {
    const { fetch, urls } = replay(pune);
    const result = await searchPlaces("Pune", "en", { fetch });
    if (!result.ok) throw new Error(result.error);
    expect(suggestionLabel(result.value[0])).toBe("Pune, Maharashtra, India");
    expect(result.value[0]).toMatchObject({ countryCode: "IN" });
    expect(new URL(urls[0]).searchParams.get("count")).toBe("5");
  });

  it("waits for 3 letters, handles no results and failures", async () => {
    const { fetch, urls } = replay(pune);
    expect(await searchPlaces("Pu", "en", { fetch })).toEqual({ ok: true, value: [] });
    expect(urls).toHaveLength(0);
    expect(await searchPlaces("Zzzq", "en", replay({}))).toEqual({ ok: true, value: [] });
    expect(await searchPlaces("Pune", "hi", replay({}, 500))).toEqual({ ok: false, error: "http" });
    expect(geocodeUrl("  Pune ", "hi")).toContain("name=Pune&");
    const sparse = await searchPlaces("Xyz", "en", replay({ results: [{ id: 1, name: "Xyz", latitude: 1, longitude: 2 }] }));
    expect(sparse.ok && suggestionLabel(sparse.value[0])).toBe("Xyz");
  });
});

describe("place name (BigDataCloud)", () => {
  it("names the recorded Green Park location and rounds what it sends", async () => {
    const { fetch, urls } = replay(reverse);
    expect(await reverseGeocode(GREEN_PARK, "en", { fetch })).toEqual({
      ok: true,
      value: { name: "South Delhi, Delhi", countryCode: "IN" },
    });
    expect(urls[0]).toBe(reverseUrl(GREEN_PARK, "en"));
    expect(new URL(urls[0]).searchParams.get("latitude")).toBe("28.56");
  });

  it("falls back to the city, then the country, and passes failures through", async () => {
    const base = { city: "", locality: "", principalSubdivision: "", countryName: "India", countryCode: "IN" };
    expect(toPlaceName({ ...base, city: "Pune", principalSubdivision: "Maharashtra" }).name).toBe("Pune, Maharashtra");
    expect(toPlaceName({ ...base, city: "Delhi", principalSubdivision: "Delhi" }).name).toBe("Delhi");
    expect(toPlaceName(base).name).toBe("India");
    expect(await reverseGeocode(GREEN_PARK, "hi", replay({}, 429))).toEqual({ ok: false, error: "http" });
  });
});
