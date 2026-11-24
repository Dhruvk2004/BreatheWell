import { SCENARIO_IDS } from "@/data/recorded/scenarios";
import { DEMO_VIEWERS, type DemoViewer } from "./family";

/** The demo's three scenarios and the time-of-day stepper (6 am · 12 pm · 4 pm). */
export const DEMO_SCENARIOS = [...SCENARIO_IDS, "live"] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];
export const DEMO_TIMES = [6, 12, 16] as const;
export type DemoTime = (typeof DEMO_TIMES)[number];

/** The demo state, carried in the URL so every switch is a plain link. */
export interface DemoQuery {
  readonly scenario: DemoScenario;
  readonly time: DemoTime;
  readonly view: DemoViewer;
}

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

const pick = <T extends string | number>(options: readonly T[], raw: unknown, fallback: T): T =>
  options.find((o) => String(o) === String(Array.isArray(raw) ? raw[0] : raw)) ?? fallback;

/** The demo state from the URL; anything unknown falls back to Smog morning, 6 am, Neha. */
export function parseDemoQuery(params: SearchParams): DemoQuery {
  return {
    scenario: pick(DEMO_SCENARIOS, params.scenario, "smog-morning"),
    time: pick(DEMO_TIMES, params.time, 6),
    view: pick(DEMO_VIEWERS, params.view, "neha"),
  };
}

/** The demo URL for a state: every switch is a plain link, so the demo works without JavaScript. */
export function demoHref(query: DemoQuery, path = "/demo"): string {
  const params = new URLSearchParams({ scenario: query.scenario, time: String(query.time), view: query.view });
  return `${path}?${params.toString()}`;
}
