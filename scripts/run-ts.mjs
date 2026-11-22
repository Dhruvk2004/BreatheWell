/**
 * Runs a TypeScript script with the app's `@/` imports (jiti, already a dev dependency), so the
 * scripts use the exact prompt, schema and validator the app ships. Usage:
 *   node scripts/run-ts.mjs scripts/record-demo-plans.ts
 */
import { createJiti } from "jiti";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/run-ts.mjs <script.ts>");
  process.exit(2);
}
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") }, interopDefault: true });
await jiti.import(resolve(target));
