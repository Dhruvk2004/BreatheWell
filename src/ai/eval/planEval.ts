import { familyDay } from "@/domain/family/familyDay";
import { nameWords, planCheck } from "@/ai/plan/check";
import { generatePlan, type Generated } from "@/ai/plan/generate";
import type { PlanCheck } from "@/ai/plan/validate";
import type { JsonModel } from "@/ai/shared/gemini";
import { recordedScenario } from "@/data/recorded/scenarios";
import { morningWeather } from "@/domain/air/pollutants";
import { familyLanguages } from "@/domain/family/languages";
import { EVAL_FAMILIES, type EvalFamily } from "./families";

/**
 * The GenAI eval (spec 11.4, not in CI): the 10 fixture families through the real model with the
 * same request, budget and validator as the app, reporting the field pass rate, the fallback rate
 * and latency p50/p95. Target: ≥ 95% valid and p95 ≤ 20 s. Unit tests run it with a fake model.
 */
export interface EvalCase {
  readonly id: string;
  readonly check: PlanCheck;
}

/** A family's plan request on its recorded day at the scenario clock (6:10 am). */
export function evalCase(family: EvalFamily): EvalCase | null {
  const s = recordedScenario(family.scenario);
  const clock = { now: s.scenarioNow, timeZone: "Asia/Kolkata" };
  const people = family.people;
  const day = familyDay({ air: s.air, fetchedAt: s.fetchedAt, clock, region: "igp", people, viewerId: null, home: family.home, ticks: [] });
  const adults = people.filter((p) => p.kind === "adult");
  const check = planCheck(
    {
      day,
      people,
      languageOf: Object.fromEntries(adults.map((p) => [p.id, p.lang])),
      languages: familyLanguages(adults.map((p, i) => ({ language: p.lang, planned: true, admin: i === 0 }))),
      place: s.placeName,
      home: family.home,
      weatherWhy: morningWeather(s.weather, day.summary.date)?.why ?? null,
    },
    Object.fromEntries(people.map((p) => [p.id, p.name])),
    nameWords(people.map((p) => p.name)),
  );
  return check ? { id: family.id, check } : null;
}

export const evalCases = (): EvalCase[] => EVAL_FAMILIES.flatMap((f) => evalCase(f) ?? []);

export interface EvalResult {
  readonly id: string;
  readonly outcome: string;
  readonly latencyMs: number;
  readonly passed: number;
  readonly failed: number;
}

export interface EvalReport {
  readonly cases: number;
  /** Cases the free tier refused (429): not the model's fault, so left out of every rate; re-run them. */
  readonly rateLimited: number;
  /** Replies usable at all (at least one field passed), over the measured cases. */
  readonly okRate: number;
  /** Families that got the full template plan, over the measured cases. */
  readonly fallbackRate: number;
  /** Fields that passed the validator, over all fields checked. */
  readonly fieldPassRate: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly reasons: Readonly<Record<string, number>>;
  /** ≥ 95% of fields valid, p95 ≤ 20 s, and no case rate-limited (a run with 429s proves nothing). */
  readonly meetsTarget: boolean;
  readonly results: readonly EvalResult[];
}

export const TARGET_PASS_RATE = 0.95;
export const TARGET_P95_MS = 20_000;

/** The nearest-rank percentile of a list of numbers (0 for an empty list). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

const share = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

/** Summarises the generations of an eval run. */
export function evalReport(runs: readonly { id: string; generated: Generated }[]): EvalReport {
  const results: EvalResult[] = runs.map(({ id, generated }) => ({
    id,
    outcome: generated.outcome,
    latencyMs: generated.latencyMs,
    passed: generated.plan?.passed ?? 0,
    failed: generated.plan?.failed ?? 0,
  }));
  const reasons: Record<string, number> = {};
  for (const { generated } of runs) for (const r of generated.plan?.reasons ?? [generated.outcome]) reasons[r] = (reasons[r] ?? 0) + 1;
  const measured = results.filter((r) => r.outcome !== "rate_limited");
  const ok = measured.filter((r) => r.outcome === "ok").length;
  const fields = measured.reduce((n, r) => n + r.passed + r.failed, 0);
  const latencies = measured.map((r) => r.latencyMs);
  const fieldPassRate = share(
    measured.reduce((n, r) => n + r.passed, 0),
    fields,
  );
  const p95Ms = percentile(latencies, 95);
  const rateLimited = results.length - measured.length;
  return {
    cases: results.length,
    rateLimited,
    okRate: share(ok, measured.length),
    fallbackRate: share(measured.length - ok, measured.length),
    fieldPassRate,
    p50Ms: percentile(latencies, 50),
    p95Ms,
    reasons,
    meetsTarget: measured.length > 0 && rateLimited === 0 && fieldPassRate >= TARGET_PASS_RATE && p95Ms <= TARGET_P95_MS,
    results,
  };
}

/** How the eval paces its calls under the free tier's per-minute limit (spec 7.8). */
export interface EvalPace {
  readonly rpm: number;
  sleep(ms: number): Promise<void>;
}

/**
 * Runs every case one after another, never in parallel, waiting 60 s / RPM per call the previous
 * case made (a retry counts), so the eval never trips the per-minute limit itself.
 */
export async function runPlanEval(cases: readonly EvalCase[], model: JsonModel, now: () => number, pace: EvalPace): Promise<EvalReport> {
  const gapMs = Math.ceil(60_000 / pace.rpm);
  const runs: { id: string; generated: Generated }[] = [];
  let lastCalls = 0;
  for (const c of cases) {
    if (lastCalls > 0) await pace.sleep(gapMs * lastCalls);
    const generated = await generatePlan(c.check, { model, now, reserve: async () => true });
    lastCalls = generated.attempts;
    runs.push({ id: c.id, generated });
  }
  return evalReport(runs);
}
