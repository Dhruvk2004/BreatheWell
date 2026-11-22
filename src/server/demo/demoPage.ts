import { DEMO_FAMILY, DEMO_HOME, DEMO_WEEK_TICKS, type DemoViewer } from "@/data/demo/family";
import type { DemoQuery, DemoTime } from "@/data/demo/query";
import { recordedScenario, type ScenarioId } from "@/data/recorded/scenarios";
import { familyDay } from "@/domain/family/familyDay";
import type { DemoData } from "@/view/demoPage";
import { loadAir, type AirDeps } from "../air/service";
import { demoWords, hasStoredPlan } from "./demoPlan";

const HOUR_MS = 3_600_000;

/** A recorded day at the stepper hour: the scenario clock moves, and the reading counts as taken then. */
function recorded(id: ScenarioId, time: DemoTime) {
  const s = recordedScenario(id);
  const clock = { now: new Date(s.scenarioNow.getTime() + (time - 6) * HOUR_MS), timeZone: "Asia/Kolkata" };
  return { source: "recorded" as const, recordedDate: s.date, air: s.air, weather: s.weather, clock, fetchedAt: clock.now };
}

/** Live today: Green Park's live air with the real clock, or the saved snapshot when Open-Meteo fails. */
async function live(deps: AirDeps) {
  const fallback = recordedScenario("live-fallback");
  const snapshot = await loadAir({ lat: fallback.lat, lon: fallback.lon }, deps);
  if (!snapshot) {
    const clock = { now: fallback.scenarioNow, timeZone: "Asia/Kolkata" };
    return {
      source: "fallback" as const,
      recordedDate: fallback.date,
      air: fallback.air,
      weather: fallback.weather,
      clock,
      fetchedAt: fallback.fetchedAt,
    };
  }
  const clock = { now: deps.now(), timeZone: snapshot.timeZone };
  return {
    source: "live" as const,
    recordedDate: null,
    air: snapshot.air,
    weather: snapshot.weather,
    clock,
    fetchedAt: snapshot.fetchedAt,
  };
}

type Base = ReturnType<typeof recorded> | Awaited<ReturnType<typeof live>>;

function withPlan(query: DemoQuery, base: Base): DemoData {
  const day = familyDay({
    air: base.air,
    fetchedAt: base.fetchedAt,
    clock: base.clock,
    region: "igp",
    people: DEMO_FAMILY,
    viewerId: query.view,
    home: DEMO_HOME,
    ticks: DEMO_WEEK_TICKS,
  });
  const words = { en: demoWords(query, day, "en"), hi: demoWords(query, day, "hi") };
  const { source, recordedDate, air, weather, clock } = base;
  return { query, source, recordedDate, air, weather, clock, day, words, storedPlan: hasStoredPlan(query) };
}

/** A recorded scenario planned for the Sharma family; synchronous, so static pages can show it (Landing preview). */
export const recordedDemo = (scenario: ScenarioId, time: DemoTime, view: DemoViewer): DemoData =>
  withPlan({ scenario, time, view }, recorded(scenario, time));

/** Loads the demo for a query and plans the Sharma family with the rules (code only, spec 10.3). */
export async function loadDemo(query: DemoQuery, deps: AirDeps): Promise<DemoData> {
  return query.scenario === "live" ? withPlan(query, await live(deps)) : recordedDemo(query.scenario, query.time, query.view);
}
