/**
 * The GenAI eval (spec 11.4; run on 24 and 27 Nov, never in CI): the 10 fixture families through
 * the real model, reporting the validator pass rate, the fallback rate and latency p50/p95.
 * It needs its own key (spec 7.8) and refuses the production one:
 *   GEMINI_EVAL_API_KEY=<eval key> npm run eval:gemini [-- --out eval-results.json]
 * Calls are paced under the per-minute limit. Exits 1 when the target (≥ 95% valid, p95 ≤ 20 s,
 * no 429s) is missed, 2 without a usable key.
 */
import { writeFile } from "node:fs/promises";
import { evalKey } from "@/ai/eval/evalKey";
import { evalCases, runPlanEval, TARGET_P95_MS, TARGET_PASS_RATE } from "@/ai/eval/planEval";
import { createGeminiModel } from "@/ai/shared/gemini";
import { GEMINI_LIMITS } from "@/server/repos/quota";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const key = evalKey(process.env);
  if (!key.ok) {
    console.error(
      key.reason === "missing"
        ? "GEMINI_EVAL_API_KEY is not set (a separate eval key, never the production one)."
        : "GEMINI_EVAL_API_KEY equals GEMINI_API_KEY: the eval never runs against the production key.",
    );
    process.exitCode = 2;
    return;
  }
  const report = await runPlanEval(evalCases(), createGeminiModel(key), () => Date.now(), { rpm: GEMINI_LIMITS.rpm, sleep });
  console.log(`Model ${key.model} · ${report.cases} families · ${report.rateLimited} rate-limited (429)`);
  console.log(`Validator pass rate ${pct(report.fieldPassRate)} (target ${pct(TARGET_PASS_RATE)})`);
  console.log(`Usable replies ${pct(report.okRate)} · full fallbacks ${pct(report.fallbackRate)}`);
  console.log(`Latency p50 ${report.p50Ms} ms · p95 ${report.p95Ms} ms (target ≤ ${TARGET_P95_MS} ms)`);
  console.log("Reasons:", report.reasons);
  if (report.rateLimited > 0) console.log("Some calls hit the free tier's limit: wait a minute and run again.");
  const out = process.argv.indexOf("--out");
  if (out > 0 && process.argv[out + 1]) await writeFile(process.argv[out + 1], `${JSON.stringify(report, null, 2)}\n`);
  if (!report.meetsTarget) process.exitCode = 1;
}

await main();
