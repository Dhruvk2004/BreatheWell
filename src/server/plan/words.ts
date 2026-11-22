import type { PersonPlan } from "@/domain/family/people";
import type { Lang } from "@/domain/time/format";
import type { PlanWords, Words } from "@/view/app";
import { isCurrent, MAX_GENERATIONS } from "../repos/plans";
import type { StoredPlan } from "../repos/planRecords";
import { PLAN_TOKEN } from "@/ai/plan/tokens";
import { sameRule, snapshotOf } from "./sections";

/**
 * The stored Gemini words a page may show (spec 7.2, principle 3): only in the page language, only
 * for items whose rule result is unchanged since generation, with `{m1}` tokens filled in from the
 * current family. Everything else keeps its template text, and the source line says "Simple plan"
 * when no Gemini words are left on screen.
 */
type Text = { readonly en?: string; readonly hi?: string };

export interface WordsContext {
  readonly lang: Lang;
  /** Person id → current name. */
  readonly nameOf: Readonly<Record<string, string>>;
  /** Gemini configured, after 5 am, budget left: the client may ask for a generation. */
  readonly canGenerate: boolean;
}

/** The text in the page language with names filled in; null when missing or a person has left. */
function render(text: Text | undefined, tokens: Readonly<Record<string, string>>, ctx: WordsContext): string | null {
  const value = text?.[ctx.lang];
  if (!value) return null;
  let gone = false;
  const out = value.replace(PLAN_TOKEN, (_, token: string) => {
    const name = ctx.nameOf[tokens[token] ?? ""];
    if (name === undefined) gone = true;
    return name ?? "";
  });
  return gone ? null : out;
}

interface StoredWords {
  readonly doThis: Text;
  readonly why?: Text;
  readonly factId?: string;
}

/** Stored words as shown; `why` keeps the fact it explains, so a page shows it only under that fact. */
function wordsOf(stored: StoredWords, tokens: Readonly<Record<string, string>>, ctx: WordsContext): Words | null {
  const main = render(stored.doThis, tokens, ctx);
  if (!main) return null;
  const reason = render(stored.why, tokens, ctx);
  if (!reason) return { doThis: main };
  return { doThis: main, why: reason, ...(stored.factId ? { factId: stored.factId } : {}) };
}

const EMPTY = { rows: {}, items: {}, swaps: {}, home: {}, together: null };

/** The words for today's rows, items, swaps, home tips and Help the air. */
export function planWords(stored: StoredPlan | null, rows: readonly PersonPlan[], ctx: WordsContext): PlanWords {
  const plan = stored?.plan ?? null;
  const current = isCurrent(plan);
  const generations = plan?.generations ?? 0;
  const capped = !current && generations >= MAX_GENERATIONS;
  const canRetry = ctx.canGenerate && current && plan?.source === "template" && generations < MAX_GENERATIONS;
  const status = { generatedAt: plan?.generatedAt ?? null, pending: ctx.canGenerate && !current && !capped, capped, canRetry };
  if (!stored || plan?.source !== "gemini") return { source: "template", ...status, ...EMPTY };
  const { tokens } = stored.plan;
  const rowsOut: Record<string, string> = {};
  const items: Record<string, Record<string, Words>> = {};
  const swaps: Record<string, Words & { altId: string }> = {};
  for (const row of rows) {
    const section = stored.sections[row.person.id];
    if (!section) continue;
    const { line } = section;
    const fits = line && row.headline?.activity.id === line.activityId && sameRule(line.rule, snapshotOf(row.headline.plan));
    const lineText = fits ? render(line.text, tokens, ctx) : null;
    if (lineText) rowsOut[row.person.id] = lineText;
    items[row.person.id] = itemsOf(section, row, tokens, ctx);
    const swap = section.swap ? wordsOf(section.swap, tokens, ctx) : null;
    if (swap && section.swap) swaps[row.person.id] = { ...swap, altId: section.swap.altId };
  }
  const home = Object.fromEntries(stored.plan.home.flatMap((t) => toEntry(t.tipId, wordsOf(t, tokens, ctx))));
  const together = stored.plan.together ? wordsOf(stored.plan.together, tokens, ctx) : null;
  // Every Gemini sentence on screen counts, so Monsoon "Made by" is shown whenever one is (design rule).
  const counts = [
    Object.keys(rowsOut).length,
    ...Object.values(items).map((i) => Object.keys(i).length),
    Object.keys(swaps).length,
    Object.keys(home).length,
  ];
  const used = counts.reduce((n, c) => n + c, together ? 1 : 0);
  return { source: used > 0 ? "gemini" : "template", ...status, rows: rowsOut, items, swaps, home, together };
}

/**
 * The source line for one person's page (stage 7 AI-10): Gemini only when that person's own line,
 * items or swap use Gemini's words, not another member's.
 */
export function pageSource(words: PlanWords, id: string): PlanWords["source"] {
  if (words.source !== "gemini") return "template";
  const own = Boolean(words.rows[id]) || Object.keys(words.items[id] ?? {}).length > 0 || Boolean(words.swaps[id]);
  return own ? "gemini" : "template";
}

const toEntry = (key: string, words: Words | null): [string, Words][] => (words ? [[key, words]] : []);

function itemsOf(section: StoredPlan["sections"][string], row: PersonPlan, tokens: Readonly<Record<string, string>>, ctx: WordsContext) {
  const items: Record<string, Words> = {};
  for (const { activity, plan } of row.items) {
    const stored = section.items[activity.id];
    const words = stored && sameRule(stored.rule, snapshotOf(plan)) ? wordsOf(stored, tokens, ctx) : null;
    if (words) items[activity.id] = words;
  }
  return items;
}
