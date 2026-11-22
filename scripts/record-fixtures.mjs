/**
 * Records the free, no-key API responses used as fixtures (spec 10.3 recorded demo days, and the
 * data/ client tests). Run by hand with `npm run fixtures:record`; never in CI or at build time.
 * The numbers are saved exactly as Open-Meteo returns them: we never scale or edit them (spec 10.3).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR_VARS = "pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide";
const WEATHER_VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m";
const GREEN_PARK = { latitude: 28.56, longitude: 77.21 };

/** The two recorded Delhi days chosen from the Nov 2023 – Nov 2025 history scan (build log, 21 Nov). */
const SCENARIOS = [
  { id: "smog-morning", date: "2024-11-18", start: "2024-11-17", end: "2024-11-22", scenarioNow: "2024-11-18T06:10:00+05:30" },
  { id: "severe-day", date: "2025-01-31", start: "2025-01-30", end: "2025-02-04", scenarioNow: "2025-01-31T06:10:00+05:30" },
];

const query = (params) => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

async function getJson(base, params) {
  const url = `${base}?${query(params)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return { url, body: await response.json() };
}

async function save(relative, value) {
  const path = join(ROOT, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 1)}\n`);
  console.log("wrote", relative);
}

async function recordScenario({ id, date, start, end, scenarioNow }) {
  const range = { ...GREEN_PARK, timezone: "Asia/Kolkata", start_date: start, end_date: end };
  const air = await getJson(AIR, { ...range, hourly: AIR_VARS });
  const weather = await getJson(ARCHIVE, { ...range, hourly: WEATHER_VARS, wind_speed_unit: "kmh" });
  await save(`src/data/recorded/${id}.json`, {
    id,
    date,
    place: { name: "Green Park, New Delhi", ...GREEN_PARK },
    scenarioNow,
    fetchedAt: scenarioNow,
    recordedOn: new Date().toISOString().slice(0, 10),
    sources: [air.url, weather.url],
    air: air.body,
    weather: weather.body,
  });
}

async function recordLive() {
  const live = { ...GREEN_PARK, timezone: "auto", forecast_days: 5, past_days: 1 };
  const air = await getJson(AIR, { ...live, hourly: AIR_VARS });
  const weather = await getJson(FORECAST, { ...live, hourly: WEATHER_VARS });
  await save("tests/fixtures/api/air-delhi.json", air.body);
  await save("tests/fixtures/api/weather-delhi.json", weather.body);
  // The demo's "Live today" fallback when Open-Meteo is down (spec 10.3), stamped with the recording time.
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16);
  await save("src/data/recorded/live-fallback.json", {
    id: "live-fallback",
    date: ist.slice(0, 10),
    place: { name: "Green Park, New Delhi", ...GREEN_PARK },
    scenarioNow: `${ist}:00+05:30`,
    fetchedAt: `${ist}:00+05:30`,
    recordedOn: ist.slice(0, 10),
    sources: [air.url, weather.url],
    air: air.body,
    weather: weather.body,
  });
  const search = { name: "Pune", count: 5, language: "en", format: "json" };
  await save("tests/fixtures/api/geocode-pune.json", (await getJson("https://geocoding-api.open-meteo.com/v1/search", search)).body);
  const reverse = { ...GREEN_PARK, localityLanguage: "en" };
  await save(
    "tests/fixtures/api/reverse-delhi.json",
    (await getJson("https://api.bigdatacloud.net/data/reverse-geocode-client", reverse)).body,
  );
}

for (const scenario of SCENARIOS) await recordScenario(scenario);
await recordLive();
