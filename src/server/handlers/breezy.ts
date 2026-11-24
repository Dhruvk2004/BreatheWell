import { askGemini } from "@/ai/breezy/generate";
import { filled } from "@/ai/plan/fields";
import type { JsonModel } from "@/ai/shared/gemini";
import { askBody, type BreezyAnswer, type BreezyCard } from "@/domain/breezy/answer";
import { tokeniseQuestion, type NamedPerson } from "@/domain/breezy/names";
import { cleanQuestion, cleanText, historyText, type Turn } from "@/domain/breezy/question";
import type { Aliases } from "@/domain/names/kin";
import { kinOf } from "@/domain/names/kin";
import { isEmergency } from "@/domain/safety/emergency";
import type { Lang } from "@/domain/time/format";
import { familyOfCaller, type Caller } from "../app/caller";
import { planFamilyToday } from "../app/familyPlan";
import { authorize } from "../auth/guard";
import { breezyContext, type BreezyContext } from "../breezy/context";
import { resolveCards } from "../breezy/cards";
import { privacyPeople } from "../breezy/privacy";
import type { AppDeps } from "../deps";
import { errorResponse, forbidden, privateJson, rateLimited, readJson } from "../http";
import { reserveBreezyQuestion } from "../repos/breezyQuota";
import { reserveGeminiCall } from "../repos/quota";
import type { Db } from "../db/types";

/**
 * `POST /api/breezy`. In order: emergency words get the fixed text (no Gemini,
 * before any limit); then the per-minute limit; a kin word with no alias gets the code question
 * "Who do you mean by 'Papa'?" (nothing is sent); then the daily caps and the global budget, one
 * Gemini call of at most 10 s, the validator and the rules again on every card. The question and
 * every history turn go out with names swapped for tokens. Any failure answers "basics".
 * Logs outcome codes only; the question is never stored or logged.
 */
const answer = (body: BreezyAnswer): Response => privateJson(body);

interface Asker extends Caller {
  readonly uid: string;
  readonly db: Db;
}

export async function askBreezy(request: Request, deps: AppDeps): Promise<Response> {
  const auth = await authorize(request, deps, "write");
  if (!auth.ok) return auth.response;
  const input = await readJson(request, askBody);
  if (!input.ok) return input.response;
  const question = cleanQuestion(input.data.question);
  if (!question) return errorResponse(400, "invalid_input", "Type a question.");
  // The whole typed text (up to 600 characters), not only the 300 that would be sent.
  if (isEmergency(cleanText(input.data.question))) return answer({ kind: "emergency" });
  const { uid } = auth.session;
  const limit = deps.limits.breezy.check(uid);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  const caller = await familyOfCaller(auth.db, uid);
  if (!caller) return forbidden("You're no longer in this family.");
  return answer(await thinkAbout({ ...caller, uid, db: auth.db }, question, input.data.history, deps));
}

/**
 * The history as Gemini gets it: every turn cleaned (folded) first, then names and aliases swapped
 * for tokens (spec 7.7.9; stage 7 AI-8: a zero-width or look-alike name is folded before matching).
 */
export function tokenisedHistory(turns: readonly Turn[], people: readonly NamedPerson[], aliases: Aliases): string {
  return historyText(turns.map((turn) => ({ ...turn, text: tokeniseQuestion(cleanText(turn.text), people, aliases).text })));
}

async function thinkAbout(asker: Asker, question: string, turns: readonly Turn[], deps: AppDeps): Promise<BreezyAnswer> {
  const lang: Lang = asker.user.language;
  const planned = await planFamilyToday(asker.bundle, asker.uid, deps.air);
  const ctx = breezyContext(asker.bundle, planned, asker.uid, lang);
  const people = privacyPeople(asker.bundle, ctx?.people ?? [], lang);
  const { aliases } = asker.user;
  const tokenised = tokeniseQuestion(question, people, aliases);
  const kin = tokenised.unmapped[0];
  if (kin) return { kind: "ask_alias", kin, word: wordFor(question, kin) };
  if (!ctx || !deps.gemini) return { kind: "basics" };
  if (!(await reserveBreezyQuestion(asker.db, asker.uid, asker.bundle.id, deps.now()))) return { kind: "quota" };
  const history = tokenisedHistory(turns, people, aliases);
  return reply({ ctx, model: deps.gemini, question: tokenised.text, history }, asker, deps);
}

interface Call {
  readonly ctx: BreezyContext;
  readonly model: JsonModel;
  readonly question: string;
  readonly history: string;
}

/** Cards a refusal keeps: none for off-topic or other refusals. */
const keptCards = (cards: BreezyCard[], refusal: string | null): BreezyCard[] =>
  refusal === "off_topic" || refusal === "other" ? [] : cards;

async function reply({ ctx, model, question, history }: Call, asker: Asker, deps: AppDeps): Promise<BreezyAnswer> {
  const started = deps.now().getTime();
  const result = await askGemini(ctx.check, question, history, {
    model,
    reserve: () => reserveGeminiCall(asker.db, "breezy", deps.now()),
  });
  const refusal = result.reply?.refusal ?? null;
  const cards = result.reply ? keptCards(resolveCards(result.reply.cards, ctx), refusal) : [];
  deps.log("breezy_answered", { outcome: result.outcome, latencyMs: deps.now().getTime() - started, cards: cards.length });
  if (result.outcome === "quota") return { kind: "quota" };
  if (!result.reply) return { kind: "basics" };
  return { kind: "reply", text: filled(result.reply.text, ctx.check.nameOf), lang: result.reply.lang, cards, refusal };
}

/** The kin word as the asker typed it ("Papa", "पापा"), for "Who do you mean by 'Papa'?". */
function wordFor(question: string, kin: string): string {
  return (
    question
      .normalize("NFC")
      .match(WORD)
      ?.find((w) => kinOf(w)?.key === kin) ?? kin
  );
}

const WORD = /[\p{L}\p{M}\p{N}]+/gu;
