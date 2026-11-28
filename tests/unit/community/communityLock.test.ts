import { describe, expect, it, vi } from "vitest";
import { agreesWithBand } from "@/ai/community/bandCheck";
import type { CommunityOutput, CommunityPromptInput } from "@/ai/community/schema";
import { communityWords, type WordsRequest } from "@/server/community/words";
import { claimCommunity, COMMUNITY_LOCK_MS, communityKey } from "@/server/repos/communityCache";
import { MemoryDb } from "../../helpers/memoryDb";
import { NOW } from "../../helpers/airDeps";
import { fakeModel } from "../../helpers/planReply";

/** The community cache's lock, its best-window match, and the band check. */
const WORDS: CommunityOutput = {
  en: { title: "Smog morning", body: "Keep morning walks indoors. Keep windows shut this morning.", together: "no burning." },
  hi: { title: "धुंध वाली सुबह", body: "सुबह की सैर घर के अंदर करें। सुबह खिड़कियाँ बंद रखें।", together: "कुछ न जलाएँ।" },
};
const INPUT: CommunityPromptInput = {
  place: "Delhi",
  audience: "housing_society",
  band: "very_poor",
  bestWindow: "14:00-16:00",
  worstWindow: "06:00-08:00",
  windowDay: "today",
  together: "no_leaf_burning",
};
const TIMES = [14, 16, 6, 8].map((hour) => ({ hour, minute: 0 }));
const req: WordsRequest = { gridId: "28.6_77.2", date: "2024-11-18", hour: 6, eligible: true, input: INPUT, times: TIMES };
const KEY = communityKey("28.6_77.2", "2024-11-18");

function setup(reply: () => string = () => JSON.stringify(WORDS)) {
  const db = new MemoryDb();
  const model = fakeModel(reply);
  return { db, model, deps: { db, gemini: model, now: () => NOW, log: vi.fn() } };
}

describe("communityWords lock and fit", () => {
  it("makes one model call for two concurrent first requests; the other gets the template", async () => {
    const { model, deps } = setup();
    const results = await Promise.all([communityWords(req, deps), communityWords(req, deps)]);
    expect(model.calls).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(await communityWords(req, deps)).toEqual(WORDS);
  });

  it("serves the template while another caller holds the lock, and takes it once it lapses", async () => {
    const { db, model, deps } = setup();
    expect(await claimCommunity(db, KEY, NOW)).toBe(true);
    expect(await communityWords(req, deps)).toBeNull();
    expect(model.calls).toHaveLength(0);
    const later = new Date(NOW.getTime() + COMMUNITY_LOCK_MS + 1);
    expect(await communityWords(req, { ...deps, now: () => later })).toEqual(WORDS);
  });

  it("gives the lock back after a failed generation", async () => {
    const { db, deps } = setup(() => "{}");
    expect(await communityWords(req, deps)).toBeNull();
    expect(db.docs.get(`communityCache/${KEY}`)).toMatchObject({ lockedUntil: null });
    expect(await claimCommunity(db, KEY, NOW)).toBe(true);
  });

  it("regenerates once when the best window changes, then shows the template", async () => {
    const { db, model, deps } = setup();
    await communityWords(req, deps);
    const moved = { ...req, input: { ...INPUT, bestWindow: "15:00-17:00" } };
    expect(await communityWords(moved, deps)).toEqual(WORDS);
    expect(db.docs.get(`communityCache/${KEY}`)).toMatchObject({ bestWindow: "15:00-17:00", regenerated: true });
    expect(await communityWords({ ...req, input: { ...INPUT, bestWindow: "16:00-18:00" } }, deps)).toBeNull();
    expect(model.calls).toHaveLength(2);
  });
});

describe("agreesWithBand", () => {
  const poor = { band: "very_poor" as const, bestWindow: "14:00-16:00" };
  it.each([
    "Walks are fine today.",
    "Children can play outside at 11 am.",
    "Go for your walk after 5 pm.",
    "आज सैर ठीक है।",
    "बच्चे सुबह 10 बजे पार्क में खेलें।",
  ])("rejects %s on a Very poor day", (text) => expect(agreesWithBand(text, poor)).toBe(false));

  it.each([
    "Keep morning walks indoors.",
    "Children can play after 2 pm.",
    "Skip the morning walk today.",
    "सुबह की सैर घर के अंदर करें।",
    "बच्चे दोपहर 3 बजे खेलें।",
    "Keep windows shut this morning.",
  ])("accepts %s", (text) => expect(agreesWithBand(text, poor)).toBe(true));

  it("allows any outing below Poor, and none without a window on a Poor day", () => {
    expect(agreesWithBand("Walks are fine today.", { band: "moderate", bestWindow: null })).toBe(true);
    expect(agreesWithBand("Play at 3 pm.", { band: "poor", bestWindow: null })).toBe(false);
    expect(agreesWithBand("Play at 3 pm.", { band: "poor", bestWindow: "bad" })).toBe(false);
  });
});
