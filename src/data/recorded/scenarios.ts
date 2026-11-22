import { z } from "zod";
import type { HourlyAir } from "@/domain/air/hourly";
import type { HourlyWeather } from "@/domain/air/weatherWhy";
import { toHourlyAir, toHourlyWeather } from "../openMeteo/air";
import { airQualityResponse, weatherResponse } from "../openMeteo/schemas";
import liveFallback from "./live-fallback.json";
import severeDay from "./severe-day.json";
import smogMorning from "./smog-morning.json";

/**
 * The recorded demo days (spec 10.3), saved exactly as Open-Meteo returned them by
 * `scripts/record-fixtures.mjs` and parsed with the same schemas as live data.
 */
export const SCENARIO_IDS = ["smog-morning", "severe-day"] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** The recorded days plus the "Live today" fallback snapshot (Delhi, 20 Nov 2026, 4:30 pm; spec 10.3). */
export const RECORDED_IDS = [...SCENARIO_IDS, "live-fallback"] as const;
export type RecordedId = (typeof RECORDED_IDS)[number];

const recordedFile = z.object({
  id: z.enum(RECORDED_IDS),
  date: z.string(),
  place: z.object({ name: z.string(), latitude: z.number(), longitude: z.number() }),
  scenarioNow: z.string(),
  fetchedAt: z.string(),
  recordedOn: z.string(),
  sources: z.array(z.string()),
  air: airQualityResponse,
  weather: weatherResponse,
});

export interface RecordedScenario {
  readonly id: RecordedId;
  readonly date: string;
  readonly placeName: string;
  readonly lat: number;
  readonly lon: number;
  /** The scenario clock's instant (e.g. that date at 06:10 IST). */
  readonly scenarioNow: Date;
  readonly fetchedAt: Date;
  readonly sources: readonly string[];
  readonly air: HourlyAir;
  readonly weather: HourlyWeather;
}

/** Parses one recorded file; throws if a fixture was edited into the wrong shape (caught by tests). */
export function parseScenario(raw: unknown): RecordedScenario {
  const file = recordedFile.parse(raw);
  return {
    id: file.id,
    date: file.date,
    placeName: file.place.name,
    lat: file.place.latitude,
    lon: file.place.longitude,
    scenarioNow: new Date(file.scenarioNow),
    fetchedAt: new Date(file.fetchedAt),
    sources: file.sources,
    air: toHourlyAir(file.air),
    weather: toHourlyWeather(file.weather),
  };
}

const FILES: Readonly<Record<RecordedId, unknown>> = { "smog-morning": smogMorning, "severe-day": severeDay, "live-fallback": liveFallback };

const PARSED = new Map<RecordedId, RecordedScenario>();

/** A recorded day by id, parsed once per server instance. */
export function recordedScenario(id: RecordedId): RecordedScenario {
  const cached = PARSED.get(id);
  if (cached) return cached;
  const parsed = parseScenario(FILES[id]);
  PARSED.set(id, parsed);
  return parsed;
}
