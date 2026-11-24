import { z } from "zod";
import { apiRequest, type Fetch } from "./api";

/**
 * Asking the server for today's Gemini wording. "busy" means another member's request
 * holds the lock: ask again after the time the server gives (at most 10 s), until the badge's 30 s
 * are up. The answer is final: "ready" (refresh the page) or "simple" (keep the template).
 */
const answer = z.object({ state: z.enum(["ready", "busy", "template", "capped"]), retryAfterMs: z.number().optional() });

export const BADGE_TIMEOUT_MS = 30_000;
const MAX_WAIT_MS = 10_000;

export interface PlanClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const browserClock: PlanClock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

export async function askForPlan(retry: boolean, fetcher: Fetch = fetch, clock: PlanClock = browserClock): Promise<"ready" | "simple"> {
  const start = clock.now();
  try {
    for (;;) {
      const result = await apiRequest("/api/plan", answer, { method: "POST", body: { retry } }, fetcher);
      if (result.state === "ready") return "ready";
      if (result.state !== "busy") return "simple";
      const wait = Math.min(result.retryAfterMs ?? MAX_WAIT_MS, MAX_WAIT_MS);
      if (clock.now() - start + wait > BADGE_TIMEOUT_MS) return "simple";
      await clock.sleep(wait);
    }
  } catch {
    return "simple";
  }
}
