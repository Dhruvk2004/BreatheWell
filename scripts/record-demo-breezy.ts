/**
 * Records the Breezy demo's chip answers with Gemini (spec 7.7.2, 7.8: the demo makes 0 live calls):
 * the Sharma family on each recorded scenario at 6 am, each demo chip in English and Hindi, through
 * the same context, prompt, validator and rules re-check as a family's question. Only validated
 * answers are stored; a chip whose reply fails keeps its previous entry (or none, so the demo
 * keeps the code's "Simple answer").
 *
 * Run once a key exists (never in CI, at build time or on page views):
 *   GEMINI_API_KEY=… npm run demo:record-breezy
 * Then review src/data/demo/storedBreezy.json and run `npm test` (every stored answer is re-checked).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { askGemini } from "@/ai/breezy/generate";
import { BREEZY_PROMPT_VERSION } from "@/ai/breezy/prompt";
import { filled } from "@/ai/plan/fields";
import { createGeminiModel } from "@/ai/shared/gemini";
import { geminiConfig } from "@/config/env";
import { SCENARIO_IDS } from "@/data/recorded/scenarios";
import { storedBreezyKey } from "@/data/demo/storedBreezy";
import { tokeniseQuestion } from "@/domain/breezy/names";
import { LANGS } from "@/domain/time/format";
import { t } from "@/i18n/t";
import { resolveCards } from "@/server/breezy/cards";
import { chipKey, DEMO_CHIPS, demoBreezyContext } from "@/server/demo/demoBreezy";
import { recordedDemo } from "@/server/demo/demoPage";
import { STORED_PLAN_HOUR } from "@/server/demo/demoPlan";

const FILE = join(process.cwd(), "src/data/demo/storedBreezy.json");

async function main(): Promise<void> {
  const config = geminiConfig(process.env);
  if (!config) {
    console.error("GEMINI_API_KEY is not set. The demo keeps its Simple answers; nothing was written.");
    process.exitCode = 1;
    return;
  }
  const model = createGeminiModel(config);
  const stored: Record<string, unknown> = JSON.parse(await readFile(FILE, "utf8"));
  for (const scenario of SCENARIO_IDS)
    for (const lang of LANGS)
      for (const chip of DEMO_CHIPS) {
        const data = recordedDemo(scenario, STORED_PLAN_HOUR, "neha");
        const ctx = demoBreezyContext(data, lang);
        if (!ctx) continue;
        const question = tokeniseQuestion(t(lang, chipKey(chip)), ctx.people, {}).text;
        const result = await askGemini(ctx.check, question, "", { model, reserve: async () => true });
        console.log(`${scenario} ${lang} ${chip}: ${result.outcome}`);
        if (!result.reply) continue;
        stored[storedBreezyKey(scenario, chip, lang)] = {
          recordedOn: new Date().toISOString(),
          model: model.name,
          promptVersion: BREEZY_PROMPT_VERSION,
          lang,
          text: filled(result.reply.text, ctx.check.nameOf),
          cards: resolveCards(result.reply.cards, ctx),
        };
      }
  await writeFile(FILE, `${JSON.stringify(stored, null, 2)}\n`);
  console.log(`Wrote ${FILE}`);
}

await main();
