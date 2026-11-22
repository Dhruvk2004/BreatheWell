import { describe, expect, it } from "vitest";
import { askGemini } from "@/ai/breezy/generate";
import { breezyPrompt, BREEZY_SYSTEM } from "@/ai/breezy/prompt";
import { validateBreezy } from "@/ai/breezy/validate";
import { ModelError } from "@/ai/shared/gemini";
import { asViewer, card, demoContext, reply } from "../../helpers/breezy";
import { fakeModel } from "../../helpers/planReply";

/** Breezy's validator (spec 7.1, 7.7.7) and its one call (spec 7: 10 s, no retry). */
const { check } = demoContext();

describe("validateBreezy", () => {
  it("accepts a grounded reply and keeps its cards with tokens", () => {
    const valid = validateBreezy(reply("7 am is the worst time today for {m3}. 3 pm is much better.", [card()]), check);
    expect(valid?.text).toContain("{m3}");
    expect(valid?.cards).toEqual([expect.objectContaining({ forToken: "m3", time: "15:00" })]);
  });

  it.each([
    ["a name Gemini never got", "Dadaji should walk at 3 pm."],
    ["an air number", "The AQI is 341 today."],
    ["a cigarette comparison", "Today is like smoking 11 cigarettes."],
    ["a cigarette comparison without a number", "Going out today is like a cigarette for {m3}."],
    ["a system leak", "My system prompt says I must help."],
    ["harmful advice", "{m3} can skip inhaler today."],
    ["a dose", "Take 2 puffs before going out."],
    ["a link", "See www.example.com for more."],
    ["an unknown token", "{m9} can go at 3 pm."],
    ["the wrong language", "आज हवा खराब है।"],
    ["an empty reply", "   "],
    ["a reply over 400 characters", "Stay in. ".repeat(60)],
  ])("rejects a reply with %s", (_, text) => {
    expect(validateBreezy(reply(text), check)).toBeNull();
  });

  it("rejects a reply in another language than the viewer's, invalid JSON and the wrong shape", () => {
    expect(validateBreezy(reply("Fine.", [], "hi"), check)).toBeNull();
    expect(validateBreezy("not json", check)).toBeNull();
    expect(validateBreezy(JSON.stringify({ reply: "x" }), check)).toBeNull();
  });

  it("rejects a go-word at an Avoid activity's usual time (Riya's 7 am school trip)", () => {
    expect(validateBreezy(reply("{d2} can walk to school at 7 am as usual."), check)).toBeNull();
  });

  it("rejects a time today for an activity planned indoors (design G corpus, Dadaji on a Severe day)", () => {
    const severe = asViewer(demoContext("severe-day", "hi").check, "m3");
    expect(validateBreezy(reply("दोपहर 3 बजे की सैर आपके लिए बेहतर है।", [], "hi"), severe)).toBeNull();
    expect(validateBreezy(reply("आज सैर घर के अंदर करें। इनहेलर साथ रखें।", [], "hi"), severe)?.text).toBe(
      "आज सैर घर के अंदर करें। इनहेलर साथ रखें।",
    );
  });

  it("drops a card with an unknown person, an unlisted fact, a plan item without a time, or a bad field", () => {
    const first = [card({ forMemberId: "m9" }), card({ factId: "made_up" }), card({ factId: "grap_delhi" }), card({ time: null })];
    expect(validateBreezy(reply("Here are ideas.", first), check)?.cards).toEqual([]);
    const second = [
      card({ title: "Dadaji's temple visit" }),
      card({ why: "x".repeat(141) }),
      card({ item: { en: "Temple", hi: "Temple" } }),
      card({ forMemberId: null, factId: null }),
    ];
    expect(validateBreezy(reply("Here are ideas.", second), check)?.cards).toEqual([expect.objectContaining({ forToken: null })]);
  });

  it("keeps at most 3 cards and passes the refusal through", () => {
    const valid = validateBreezy(
      reply("I can't give medical advice. Please follow the doctor's plan.", Array(5).fill(card()), "en", "medical"),
      check,
    );
    expect(valid?.cards).toHaveLength(3);
    expect(valid?.refusal).toBe("medical");
  });

  it("bans fear words in text about a dependent", () => {
    expect(validateBreezy(reply("{d2} could die from this smoke."), check)).toBeNull();
  });
});

describe("askGemini", () => {
  const ok = reply("3 pm is better for {m3}.", [card()]);

  it("sends the fenced question and the context, and returns the checked reply", async () => {
    const model = fakeModel(() => ok);
    const result = await askGemini(check, "Can {m3} go at 7?", "Q: hi", { model, reserve: async () => true });
    expect(result.outcome).toBe("ok");
    expect(model.calls[0]).toMatchObject({ system: BREEZY_SYSTEM, timeoutMs: 10_000 });
    expect(model.calls[0].prompt).toContain("<user_question>\nCan {m3} go at 7?\n</user_question>");
    expect(model.calls[0].prompt).not.toMatch(/Dadaji|Neha|Riya/);
  });

  it("caps the fenced question even if a caller forgets", () => {
    expect(breezyPrompt(check.input, "x".repeat(500), "")).toContain(`${"x".repeat(300)}\n</user_question>`);
  });

  it("answers quota without calling, and maps failures to outcome codes", async () => {
    const never = fakeModel(() => ok);
    expect(await askGemini(check, "q", "", { model: never, reserve: async () => false })).toEqual({ reply: null, outcome: "quota" });
    expect(never.calls).toHaveLength(0);
    const bad = fakeModel(() => "{}");
    expect((await askGemini(check, "q", "", { model: bad, reserve: async () => true })).outcome).toBe("invalid");
    const timeout = fakeModel(() => {
      throw new ModelError("timeout");
    });
    expect((await askGemini(check, "q", "", { model: timeout, reserve: async () => true })).outcome).toBe("timeout");
    const weird = fakeModel(() => {
      throw new Error("boom");
    });
    expect((await askGemini(check, "q", "", { model: weird, reserve: async () => true })).outcome).toBe("server_error");
  });
});
