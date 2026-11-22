/**
 * The history scan behind the two recorded demo days (spec 10.3, build log 21 Nov). Reads Open-Meteo
 * air-quality history for Delhi, computes the CPCB AQI with the app's own domain code (no second
 * copy of the maths) and prints the worst smog mornings: 06–09 IST, Oct–Feb, PM2.5 setting the AQI
 * (dust mornings, where PM10 leads, are not smog). Run by hand:
 * `npm run fixtures:scan`. Free, no key; never in CI or at build time.
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../src", import.meta.url).pathname } });
const { aqiFromPm } = await jiti.import("../src/domain/air/aqi.ts");

const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const POINTS = [
  { name: "Green Park", latitude: 28.56, longitude: 77.21 },
  { name: "ITO", latitude: 28.65, longitude: 77.23 },
  { name: "Rohini", latitude: 28.7, longitude: 77.1 },
];
const RANGE = { start_date: "2023-11-01", end_date: "2025-11-30" };
const MORNING = new Set([6, 7, 8, 9]);
const WINTER = new Set([10, 11, 12, 1, 2]);
const TOP = 10;

async function history(point) {
  const params = new URLSearchParams({
    ...RANGE,
    latitude: point.latitude,
    longitude: point.longitude,
    hourly: "pm2_5,pm10",
    timezone: "Asia/Kolkata",
  });
  const response = await fetch(`${AIR}?${params}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} for ${point.name}`);
  return (await response.json()).hourly;
}

/** The worst morning hour of each winter day at one point. */
function worstMornings(hourly, point) {
  const byDate = new Map();
  hourly.time.forEach((time, i) => {
    const [date, clock] = time.split("T");
    if (!MORNING.has(Number(clock.slice(0, 2))) || !WINTER.has(Number(date.slice(5, 7)))) return;
    const result = aqiFromPm({ pm25: hourly.pm2_5[i], pm10: hourly.pm10[i] });
    if (result?.main === "pm25" && result.aqi > (byDate.get(date)?.aqi ?? -1))
      byDate.set(date, { date, time: clock, aqi: result.aqi, band: result.band, pm25: hourly.pm2_5[i], point: point.name });
  });
  return [...byDate.values()];
}

const days = (await Promise.all(POINTS.map(async (p) => worstMornings(await history(p), p)))).flat();
days.sort((a, b) => b.aqi - a.aqi);
console.table(days.slice(0, TOP));
console.log(
  "Smog morning (design date) 2024-11-18:",
  days.filter((d) => d.date === "2024-11-18"),
);
