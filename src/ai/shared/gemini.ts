import { FinishReason, GoogleGenAI } from "@google/genai";

/**
 * The Gemini wrapper: server-side only, `@google/genai` with the free
 * AI Studio key, structured JSON output, thinking off, a hard timeout and no SDK retries. The caller
 * decides the one retry (only when time is left, never after a 4xx). Tests inject a fake
 * client; nothing here logs a prompt or a reply.
 */
export interface JsonRequest {
  readonly system: string;
  readonly prompt: string;
  /** Gemini-safe JSON Schema (`geminiSchemaOf`). */
  readonly schema: Record<string, unknown>;
  readonly timeoutMs: number;
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

/**
 * Why a call failed: a 4xx is never retried, and neither is a 429 (`rate_limited`: the free tier's
 * per-minute or per-day limit); the others may be once if the budget allows.
 */
export type ModelFailure = "client_error" | "rate_limited" | "server_error" | "timeout" | "empty" | "truncated";

export class ModelError extends Error {
  override name = "ModelError";
  constructor(
    readonly kind: ModelFailure,
    readonly status: number | null = null,
  ) {
    super(`Gemini call failed: ${kind}${status ? ` (${status})` : ""}`);
  }
}

/** The narrow interface the placements need, so tests swap in a fake model. */
export interface JsonModel {
  readonly name: string;
  generateJson(request: JsonRequest): Promise<string>;
}

/** The slice of `GoogleGenAI` the wrapper calls. */
export interface GenerateClient {
  readonly models: {
    generateContent(params: {
      model: string;
      contents: string;
      config: Record<string, unknown>;
    }): Promise<{ text?: string; candidates?: readonly { finishReason?: string }[] }>;
  };
}

/** The failure kind of a thrown SDK error: HTTP status first, then aborts and timeouts. */
export function failureOf(error: unknown): ModelError {
  if (error instanceof ModelError) return error;
  const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : null;
  if (status === 429) return new ModelError("rate_limited", status);
  if (status !== null) return new ModelError(status >= 400 && status < 500 && status !== 408 ? "client_error" : "server_error", status);
  const name = error instanceof Error ? error.name : "";
  return new ModelError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "server_error");
}

/** One generation, with thinking off (thinking budget 0) and the SDK's retries off. */
async function generate(client: GenerateClient, model: string, request: JsonRequest): Promise<string> {
  const response = await client.models.generateContent({
    model,
    contents: request.prompt,
    config: {
      systemInstruction: request.system,
      responseMimeType: "application/json",
      responseJsonSchema: request.schema,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
      abortSignal: AbortSignal.timeout(request.timeoutMs),
      httpOptions: { timeout: request.timeoutMs, retryOptions: { attempts: 1 } },
    },
  });
  if (response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS) throw new ModelError("truncated");
  if (!response.text) throw new ModelError("empty");
  return response.text;
}

/** The Gemini model for a config, or a fake client's model in tests. */
export function createGeminiModel(config: { apiKey: string; model: string; baseUrl?: string }, client?: GenerateClient): JsonModel {
  const httpOptions = config.baseUrl ? { httpOptions: { baseUrl: config.baseUrl } } : {};
  const sdk: GenerateClient = client ?? (new GoogleGenAI({ apiKey: config.apiKey, ...httpOptions }) as unknown as GenerateClient);
  return {
    name: config.model,
    async generateJson(request) {
      try {
        return await generate(sdk, config.model, request);
      } catch (error) {
        throw failureOf(error);
      }
    },
  };
}
