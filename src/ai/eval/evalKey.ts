import { DEFAULT_GEMINI_MODEL, type Env } from "@/config/env";

/**
 * The eval's own Gemini settings (the eval never runs against the production key). It
 * reads `GEMINI_EVAL_API_KEY`, a local-only variable outside the deploy list, and refuses a key
 * equal to `GEMINI_API_KEY`, so an eval can never spend the app's daily quota.
 */
export type EvalKey =
  | { readonly ok: true; readonly apiKey: string; readonly model: string }
  | { readonly ok: false; readonly reason: "missing" | "same_as_production" };

export function evalKey(env: Env): EvalKey {
  const apiKey = env.GEMINI_EVAL_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "missing" };
  if (apiKey === env.GEMINI_API_KEY?.trim()) return { ok: false, reason: "same_as_production" };
  return { ok: true, apiKey, model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL };
}
