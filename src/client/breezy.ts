import { z } from "zod";
import { actionAnswer, breezyAnswer, type ActionBody, type BreezyAnswer } from "@/domain/breezy/answer";
import type { Turn } from "@/domain/breezy/question";
import { apiRequest, type Fetch } from "./api";

/**
 * Breezy from the browser: ask a question with the session's last turns (held here
 * only, never stored on the server), save a name alias, and send a confirmed card.
 */
export const askBreezy = (question: string, history: readonly Turn[], fetcher?: Fetch, signal?: AbortSignal): Promise<BreezyAnswer> =>
  apiRequest("/api/breezy", breezyAnswer, { method: "POST", body: { question, history }, signal }, fetcher);

export const saveAlias = (key: string, forId: string, fetcher?: Fetch): Promise<unknown> =>
  apiRequest("/api/aliases", z.object({ ok: z.literal(true) }), { method: "PUT", body: { key, forId } }, fetcher);

export const confirmCard = (body: ActionBody, fetcher?: Fetch): Promise<z.output<typeof actionAnswer>> =>
  apiRequest("/api/breezy/action", actionAnswer, { method: "POST", body }, fetcher);
