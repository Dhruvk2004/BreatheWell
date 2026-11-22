import type { PlanRequest } from "@/ai/plan/input";
import type { PlanInputActivity, PlanOutput, PlanText } from "@/ai/plan/schema";
import { MODE_WORDS } from "@/ai/shared/contradiction";
import type { JsonModel, JsonRequest } from "@/ai/shared/gemini";
import { formatHour, parseHhMm, type Lang } from "@/domain/time/format";

/**
 * A realistic, valid Gemini reply built from a request (tests only; no real model is ever called):
 * one line per person, an item per activity that agrees with its rule, one home tip and the
 * together action, in exactly the request's languages.
 */
const both = (languages: readonly Lang[], en: string, hi: string): PlanText =>
  Object.fromEntries(languages.map((l) => [l, l === "en" ? en : hi]));

function words(token: string, a: PlanInputActivity): { en: string; hi: string } {
  const { rule } = a;
  if (rule.suggestion === "move_time" && rule.bestTime) {
    const hour = parseHhMm(rule.bestTime).hour;
    return { en: `{${token}}: go at ${formatHour(hour, "en")} instead.`, hi: `{${token}}: ${formatHour(hour, "hi")} जाएँ।` };
  }
  if (rule.suggestion === "switch_mode" && rule.switchTo) {
    const [en, ...rest] = MODE_WORDS[rule.switchTo];
    const hi = rest.find((w) => /\p{Script=Devanagari}/u.test(w)) ?? "";
    return { en: `{${token}}: take the ${en} today.`, hi: `{${token}}: आज ${hi} से जाएँ।` };
  }
  if (rule.suggestion === "indoor") return { en: `{${token}}: stay in and rest today.`, hi: `{${token}}: आज घर में आराम करें।` };
  if (rule.suggestion === "protect") return { en: `{${token}}: go slowly and keep a mask.`, hi: `{${token}}: धीरे चलें और मास्क रखें।` };
  return { en: `{${token}}: all fine as usual.`, hi: `{${token}}: सब ठीक, जैसे रोज़।` };
}

export function validReply(request: PlanRequest): PlanOutput {
  const { input, tokens } = request;
  const t = (en: string, hi: string) => both(input.languages, en, hi);
  return {
    members: input.members.map((m) => {
      const headline = m.activities.find((a) => a.id === tokens.headline[m.id]) ?? m.activities[0];
      const line = words(m.id, headline);
      return {
        memberId: m.id,
        line: t(line.en, line.hi),
        items: m.activities.slice(0, 4).map((a) => {
          const w = words(m.id, a);
          return { activityId: a.id, kind: a.rule.suggestion, doThis: t(w.en, w.hi) };
        }),
      };
    }),
    home: input.allowedTips
      .slice(0, 1)
      .map((tipId) => ({ tipId, doThis: t("Keep the windows shut this morning.", "आज सुबह खिड़कियाँ बंद रखें।") })),
    together: { altId: input.together, doThis: t("No burning of leaves or rubbish today.", "आज पत्ते या कचरा न जलाएँ।") },
  };
}

/** A fake model: answers from `reply`, after advancing the fake clock by `delayMs`. */
export function fakeModel(
  reply: (request: JsonRequest) => string,
  clock?: { advance(ms: number): void },
  delayMs = 0,
): JsonModel & { calls: JsonRequest[] } {
  const calls: JsonRequest[] = [];
  return {
    name: "fake-gemini",
    calls,
    async generateJson(request) {
      calls.push(request);
      clock?.advance(delayMs);
      return reply(request);
    },
  };
}

const RANK = { go: 0, care: 1, avoid: 2 } as const;

/** A valid reply for whatever input the prompt carries (the route builds the request itself). */
export function replyToPrompt(prompt: string): string {
  const input = JSON.parse(prompt.slice(prompt.indexOf("{"))) as PlanRequest["input"];
  const headline = Object.fromEntries(
    input.members.map((m) => {
      const sorted = [...m.activities].sort(
        (a, b) => RANK[b.rule.verdictAtUsual] - RANK[a.rule.verdictAtUsual] || a.usual.localeCompare(b.usual),
      );
      return [m.id, sorted[0].id];
    }),
  );
  return JSON.stringify(validReply({ input, tokens: { people: {}, activities: {}, headline } }));
}
