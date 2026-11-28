import { describe, expect, it, vi } from "vitest";
import { generateCommunity } from "@/ai/community/generate";
import { communityPrompt } from "@/ai/community/prompt";
import type { CommunityOutput, CommunityPromptInput } from "@/ai/community/schema";
import { validateCommunity } from "@/ai/community/validate";
import { ModelError } from "@/ai/shared/gemini";
import { communityWords, type WordsRequest } from "@/server/community/words";
import { communityKey } from "@/server/repos/communityCache";
import { MemoryDb } from "../../helpers/memoryDb";
import { NOW } from "../../helpers/airDeps";
import { fakeModel } from "../../helpers/planReply";

/** The community message: code inputs only, both languages checked, the shared daily cache. */
const WORDS: CommunityOutput = {
  en: {
    title: "Smog morning in our area",
    body: "Good morning, everyone. Keep morning walks indoors today. Children can play after 2 pm.",
    together: "no leaf or garbage burning in our society.",
  },
  hi: {
    title: "आज सुबह धुंध है",
    body: "सुप्रभात। आज सुबह की सैर घर के अंदर करें। बच्चे दोपहर 2 बजे के बाद खेलें।",
    together: "सोसाइटी में पत्ते या कचरा न जलाएँ।",
  },
};
const TIMES = [
  { hour: 14, minute: 0 },
  { hour: 16, minute: 0 },
];
const INPUT: CommunityPromptInput = {
  place: "Delhi",
  audience: "housing_society",
  band: "very_poor",
  bestWindow: "14:00-16:00",
  worstWindow: "06:00-08:00",
  windowDay: "today",
  together: "no_leaf_burning",
};
const with_ = (lang: "en" | "hi", field: "title" | "body" | "together", text: string): string =>
  JSON.stringify({ ...WORDS, [lang]: { ...WORDS[lang], [field]: text } });

describe("validateCommunity", () => {
  it("accepts grounded words in both languages", () => {
    expect(validateCommunity(JSON.stringify(WORDS), TIMES, INPUT)).toEqual(WORDS);
  });

  it.each([
    ["a cigarette comparison", with_("en", "body", "Today is like 11 cigarettes for everyone.")],
    ["an air number", with_("en", "body", "The AQI is 341 this morning.")],
    ["an hour not in the windows", with_("en", "body", "Walk at 7 am.")],
    ["English in the Hindi box", with_("hi", "body", "Good morning, everyone.")],
    ["a long title", with_("en", "title", "x".repeat(61))],
    ["a link", with_("en", "together", "see www.example.com")],
    ["not JSON", "nope"],
    ["the wrong shape", JSON.stringify({ en: WORDS.en })],
  ])("rejects %s", (_, raw) => {
    expect(validateCommunity(raw, TIMES, INPUT)).toBeNull();
  });

  it("puts only code inputs in the prompt", () => {
    expect(communityPrompt(INPUT)).toContain('"place":"Delhi"');
  });
});

describe("generateCommunity", () => {
  it("returns checked words, and outcome codes for quota and failures", async () => {
    const model = fakeModel(() => JSON.stringify(WORDS));
    expect(await generateCommunity(INPUT, TIMES, { model, reserve: async () => true })).toEqual({ words: WORDS, outcome: "ok" });
    expect(model.calls[0].timeoutMs).toBe(15_000);
    expect((await generateCommunity(INPUT, TIMES, { model, reserve: async () => false })).outcome).toBe("quota");
    const bad = fakeModel(() => "{}");
    expect((await generateCommunity(INPUT, TIMES, { model: bad, reserve: async () => true })).outcome).toBe("invalid");
    const down = fakeModel(() => {
      throw new ModelError("server_error", 503);
    });
    expect((await generateCommunity(INPUT, TIMES, { model: down, reserve: async () => true })).outcome).toBe("server_error");
    const odd = fakeModel(() => {
      throw new Error("x");
    });
    expect((await generateCommunity(INPUT, TIMES, { model: odd, reserve: async () => true })).outcome).toBe("server_error");
  });
});

describe("communityWords (shared per cell per day)", () => {
  const req: WordsRequest = { gridId: "28.6_77.2", date: "2024-11-18", hour: 6, eligible: true, input: INPUT, times: TIMES };
  const deps = (db: MemoryDb | null, reply: () => string = () => JSON.stringify(WORDS)) => {
    const model = fakeModel(reply);
    return { model, deps: { db, gemini: model, now: () => NOW, log: vi.fn() } };
  };

  it("generates once and serves every later request from the cache", async () => {
    const db = new MemoryDb();
    const { model, deps: d } = deps(db);
    expect(await communityWords(req, d)).toEqual(WORDS);
    expect(await communityWords(req, d)).toEqual(WORDS);
    expect(model.calls).toHaveLength(1);
    expect(db.docs.get(`communityCache/${communityKey("28.6_77.2", "2024-11-18")}`)).toMatchObject({
      bandAtGen: 4,
      regenerated: false,
      source: "gemini",
    });
  });

  it("regenerates at most once when the band moves by 2 or more", async () => {
    const db = new MemoryDb();
    const { model, deps: d } = deps(db);
    await communityWords(req, d);
    await communityWords({ ...req, input: { ...INPUT, band: "moderate" } }, d);
    await communityWords({ ...req, input: { ...INPUT, band: "good" } }, d);
    expect(model.calls).toHaveLength(2);
  });

  it("uses the template without Firestore, outside listed cells, before 5 am, without Gemini, or when Gemini fails", async () => {
    expect(await communityWords(req, deps(null).deps)).toBeNull();
    const { model, deps: d } = deps(new MemoryDb());
    expect(await communityWords({ ...req, eligible: false }, d)).toBeNull();
    expect(await communityWords({ ...req, hour: 4 }, d)).toBeNull();
    expect(model.calls).toHaveLength(0);
    expect(await communityWords(req, { ...d, gemini: null })).toBeNull();
    expect(await communityWords(req, deps(new MemoryDb(), () => "{}").deps)).toBeNull();
  });

  it("shows the template when a regeneration fails, as the old words no longer fit the header", async () => {
    const db = new MemoryDb();
    await communityWords(req, deps(db).deps);
    expect(await communityWords({ ...req, input: { ...INPUT, band: "good" } }, deps(db, () => "{}").deps)).toBeNull();
  });
});
