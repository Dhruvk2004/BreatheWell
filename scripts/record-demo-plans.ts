/**
 * Records the demo's stored 6 am plans with Gemini (spec 10.3, 7.8; slice 2 release blocker H1):
 * the Sharma family on each recorded scenario, through the same pseudonymised request, prompt,
 * schema and validator as a real family. Only validated words are stored; a scenario whose reply
 * fails keeps its previous entry (or none, so the demo keeps the "Simple plan" template).
 *
 * Run once a key exists (never in CI or at build time; it never runs on page views):
 *   GEMINI_API_KEY=… npm run demo:record-plans
 * Then review src/data/demo/storedPlans.json and run `npm test` (every stored line is re-checked).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generatePlan } from "@/ai/plan/generate";
import { createGeminiModel } from "@/ai/shared/gemini";
import { geminiConfig } from "@/config/env";
import { SCENARIO_IDS } from "@/data/recorded/scenarios";
import { demoPlanCheck, storedEntry } from "@/server/demo/demoPlan";
import { recordedDemo } from "@/server/demo/demoPage";
import { planResult } from "@/server/plan/run";

const FILE = join(process.cwd(), "src/data/demo/storedPlans.json");

async function main(): Promise<void> {
  const config = geminiConfig(process.env);
  if (!config) {
    console.error("GEMINI_API_KEY is not set. The demo keeps its Simple plan; nothing was written.");
    process.exitCode = 1;
    return;
  }
  const model = createGeminiModel(config);
  const stored: Record<string, unknown> = JSON.parse(await readFile(FILE, "utf8"));
  for (const scenario of SCENARIO_IDS) {
    const data = recordedDemo(scenario, 6, "neha");
    const check = demoPlanCheck(data.day, data.weather);
    if (!check) continue;
    const generated = await generatePlan(check, { model, now: () => Date.now(), reserve: async () => true });
    const summary = `${scenario}: ${generated.outcome}, ${generated.latencyMs} ms, ${generated.plan?.passed ?? 0} fields passed, ${generated.plan?.failed ?? 0} failed`;
    console.log(summary, generated.plan?.reasons.length ? `(${[...new Set(generated.plan.reasons)].join(", ")})` : "");
    if (!generated.plan) continue;
    stored[scenario] = storedEntry(planResult(generated, check, data.day.rows, new Date()), model.name);
  }
  await writeFile(FILE, `${JSON.stringify(stored, null, 2)}\n`);
  console.log(`Wrote ${FILE}`);
}

await main();
