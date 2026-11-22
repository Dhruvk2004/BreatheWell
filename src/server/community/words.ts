import { generateCommunity } from "@/ai/community/generate";
import type { CommunityOutput, CommunityPromptInput } from "@/ai/community/schema";
import type { ClockTime } from "@/ai/shared/times";
import type { JsonModel } from "@/ai/shared/gemini";
import { bandRank } from "@/domain/air/bands";
import type { Db } from "../db/types";
import {
  claimCommunity,
  communityKey,
  readCommunity,
  releaseCommunity,
  saveCommunity,
  type CachedCommunity,
} from "../repos/communityCache";
import { reserveGeminiCall } from "../repos/quota";

/**
 * The day's Gemini words for a grid cell (spec 7.6): from the shared cache while they still fit the
 * header (same best window, band within 1), else generated once after 5 am for a listed city's cell
 * (or a family home) under a lock, and regenerated at most once a day. Words that no longer fit,
 * a held lock and every failure return null: the template message.
 */
export const COMMUNITY_FROM_HOUR = 5;

export interface WordsRequest {
  readonly gridId: string;
  readonly date: string;
  readonly hour: number;
  /** A listed city's cell or a family home: only these may spend Gemini quota. */
  readonly eligible: boolean;
  readonly input: CommunityPromptInput;
  readonly times: readonly ClockTime[];
}

export interface WordsDeps {
  readonly db: Db | null;
  readonly gemini: JsonModel | null;
  now(): Date;
  log(event: string, fields?: Record<string, string | number | boolean>): void;
}

/** True when cached words still match the header from code. */
const fits = (cached: CachedCommunity, input: CommunityPromptInput): boolean =>
  cached.bestWindow === input.bestWindow && Math.abs(cached.bandAtGen - bandRank(input.band)) < 2;

export async function communityWords(req: WordsRequest, deps: WordsDeps): Promise<CommunityOutput | null> {
  const { db, gemini } = deps;
  if (!db) return null;
  const key = communityKey(req.gridId, req.date);
  const cached = await readCommunity(db, key);
  if (cached && fits(cached, req.input)) return cached.words;
  if (cached?.regenerated || !gemini || !req.eligible || req.hour < COMMUNITY_FROM_HOUR) return null;
  if (!(await claimCommunity(db, key, deps.now()))) return null;
  return generateAndSave({ db, gemini, key, regenerated: cached !== null }, req, deps);
}

interface Generation {
  readonly db: Db;
  readonly gemini: JsonModel;
  readonly key: string;
  readonly regenerated: boolean;
}

async function generateAndSave(gen: Generation, req: WordsRequest, deps: WordsDeps): Promise<CommunityOutput | null> {
  const started = deps.now().getTime();
  const result = await generateCommunity(req.input, req.times, {
    model: gen.gemini,
    reserve: () => reserveGeminiCall(gen.db, "community", deps.now()),
  });
  deps.log("community_generated", { outcome: result.outcome, latencyMs: deps.now().getTime() - started });
  if (!result.words) {
    await releaseCommunity(gen.db, gen.key);
    return null;
  }
  await saveCommunity(gen.db, gen.key, {
    words: result.words,
    together: req.input.together,
    bandAtGen: bandRank(req.input.band),
    regenerated: gen.regenerated,
    bestWindow: req.input.bestWindow,
    date: req.date,
    now: deps.now(),
  });
  return result.words;
}
