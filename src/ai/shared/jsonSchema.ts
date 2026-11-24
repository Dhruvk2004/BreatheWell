import { z } from "zod";

/**
 * JSON Schema for Gemini's structured output (`responseMimeType: application/json` plus a
 * response schema), generated from the same Zod schema that checks the reply.
 * Gemini rejects some keywords with HTTP 400, so only the supported ones are kept and the dropped
 * limits are said in words; Zod still enforces every limit on the reply.
 */
const KEPT = new Set([
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "anyOf",
  "required",
  "properties",
  "additionalProperties",
]);

/** Written forms of the limits Gemini does not accept in a schema. */
function limitHints({ maxLength, maxItems }: Record<string, unknown>): string[] {
  const hints: string[] = [];
  if (typeof maxLength === "number") hints.push(`At most ${maxLength} characters.`);
  if (typeof maxItems === "number") hints.push(`At most ${maxItems} items.`);
  return hints;
}

function forGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(forGemini);
  if (typeof node !== "object" || node === null) return node;
  const source = node as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!KEPT.has(key)) continue;
    // Under `properties` the keys are field names, which may look like keywords.
    kept[key] =
      key === "properties"
        ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, forGemini(v)]))
        : forGemini(value);
  }
  if (source.const !== undefined) kept.enum = [source.const];
  const hints = limitHints(source);
  if (hints.length > 0) kept.description = [kept.description, ...hints].filter(Boolean).join(" ");
  return kept;
}

/** The Gemini-safe JSON Schema of a Zod schema (draft 7, output side). */
export function geminiSchemaOf(schema: z.ZodType): Record<string, unknown> {
  return forGemini(z.toJSONSchema(schema, { io: "output", target: "draft-7" })) as Record<string, unknown>;
}
