import { planRequest, type PlanSource } from "./input";
import type { PlanCheck } from "./validate";

/**
 * The plan request plus what its reply is checked against (spec 7.1): the names Gemini never got
 * (any of them in a reply is a leak) and token → name, to measure lines as they will be shown.
 * Shared by the route, the demo recorder and the eval, so all three check replies the same way.
 */
export function planCheck(source: PlanSource, nameById: Readonly<Record<string, string>>, forbidden: readonly string[]): PlanCheck | null {
  const request = planRequest(source);
  if (!request) return null;
  const nameOf = Object.fromEntries(Object.entries(request.tokens.people).map(([token, id]) => [token, nameById[id] ?? ""]));
  return { request, names: forbidden, nameOf };
}

/** Every full name and each word of it (3+ letters): none may appear in Gemini's text. */
export function nameWords(names: readonly string[]): string[] {
  const words = names.flatMap((n) => n.split(/\s+/u)).filter((w) => [...w].length >= 3 && w.toLowerCase() !== "family");
  return [...new Set([...names, ...words])];
}
