// A local stand-in for Open-Meteo's air-quality and forecast APIs, for the Playwright suite only.
// It serves the recorded Delhi fixtures re-dated so "yesterday" starts the series (past_days=1),
// which keeps Air now and "Live today" deterministic and off the network. Paths under /fail answer
// 503, so a second app server can exercise the saved-reading fallback. Paths under /gemini are the
// Gemini stand-in (gemini.mjs).
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { gemini } from "./gemini.mjs";

const PORT = Number(process.env.E2E_STUB_PORT ?? 3101);
const fixture = (name) => JSON.parse(readFileSync(new URL(`../../tests/fixtures/api/${name}.json`, import.meta.url), "utf8"));
const FIXTURES = { "/v1/air-quality": fixture("air-delhi"), "/v1/forecast": fixture("weather-delhi") };

/** "2026-11-21" in the fixture's time zone, shifted by `days`. */
function localDate(timeZone, days) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The fixture with its hourly times rewritten to start at yesterday 00:00, local time. */
function redated(body) {
  const start = new Date(`${localDate(body.timezone, -1)}T00:00:00Z`).getTime();
  const time = body.hourly.time.map((_, i) => new Date(start + i * 3_600_000).toISOString().slice(0, 16));
  return { ...body, hourly: { ...body.hourly, time } };
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (await gemini(req, res, path)) return;
  const body = path === "/health" ? { ok: true } : path.startsWith("/fail") ? null : FIXTURES[path] && redated(FIXTURES[path]);
  res.writeHead(body ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify(body ?? { error: true, reason: "stub" }));
}).listen(PORT, "127.0.0.1");
