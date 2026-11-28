import { useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * The last Today plan this browser rendered, for the offline view ("Saved plan from 6:05 am"): names, verdicts and
 * the one line per person, with the times already formatted. No health tags, conditions or ids are
 * kept. It lives in this browser's storage only, and every read or write tolerates storage that is
 * blocked or full (private windows): the plan then simply is not saved.
 */
export const SAVED_PLAN_KEY = "breathewell.savedPlan.v1";

const savedPlan = z.object({
  lang: z.enum(["en", "hi"]),
  place: z.string().max(120),
  /** "6:05 am": when the plan was written (Gemini) or shown (Simple plan). */
  madeAt: z.string().max(40),
  /** "6:00 am": the air reading's time. */
  airAt: z.string().max(40),
  /** ISO: the reading's fetch time, for the freshness rule. */
  fetchedAt: z.iso.datetime(),
  rows: z.array(z.object({ name: z.string().max(80), verdict: z.enum(["go", "care", "avoid"]), line: z.string().max(300) })).max(12),
});

export type SavedPlan = z.infer<typeof savedPlan>;

type Store = Pick<Storage, "getItem" | "setItem">;

const browserStore = (): Store | null => (typeof window === "undefined" ? null : window.localStorage);

/** Keeps the plan; storage errors are ignored. */
export function savePlan(plan: SavedPlan, store: Store | null = browserStore()): void {
  try {
    store?.setItem(SAVED_PLAN_KEY, JSON.stringify(savedPlan.parse(plan)));
  } catch {
    // Storage blocked or full: nothing is saved.
  }
}

/** The raw saved text, or null (a stable string, so React can compare snapshots). */
export function readSavedRaw(store: Store | null = browserStore()): string | null {
  try {
    return store?.getItem(SAVED_PLAN_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Parses the saved text; null when missing or malformed. */
export function parseSavedPlan(raw: string | null): SavedPlan | null {
  if (!raw) return null;
  try {
    const result = savedPlan.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => undefined;

/** The saved plan's text on the client (null while server rendering and on the first client render). */
export function useSavedPlanRaw(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => readSavedRaw(),
    () => null,
  );
}
