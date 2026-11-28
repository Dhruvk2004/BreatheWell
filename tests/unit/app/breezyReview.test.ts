import { describe, expect, it } from "vitest";
import { askBreezy } from "@/server/handlers/breezy";
import { breezyAction } from "@/server/handlers/breezyAction";
import { json, request, testApp } from "../../helpers/appDeps";
import { card, reply } from "../../helpers/breezy";
import { addRiya, joins, sharmaFamily } from "../../helpers/family";
import { fakeModel } from "../../helpers/planReply";

/** Edge cases on the Breezy routes: names in history and in Devanagari, emergency first, refusals, forged actions. */
const TRIP = card({
  forMemberId: "m1",
  activityType: "travel",
  title: "Trip at 3 pm",
  item: { en: "Trip at 3 pm", hi: "दोपहर 3 बजे सफ़र" },
});

async function setup(answer: () => string = () => reply("{m1}, 3 pm is better today.", [TRIP])) {
  const model = fakeModel(() => answer());
  const app = testApp({ gemini: model });
  const { code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  const riya = await addRiya(app);
  const ask = async (question: string, history: object[] = [], uid = "neha") =>
    askBreezy(request("/api/breezy", { uid, body: { question, history } }), app.deps);
  const act = (body: object, uid = "neha") => breezyAction(request("/api/breezy/action", { uid, body }), app.deps);
  return { app, model, riya, ask, act };
}

describe("POST /api/breezy: names never reach Gemini", () => {
  it("swaps names in every history turn, Breezy's filled-in replies included", async () => {
    const { ask, model } = await setup();
    const history = [
      { role: "user", text: "Can Riya play at 4 pm?" },
      { role: "breezy", text: "Rahul and Neha can take Riya to the park at 3 pm." },
    ];
    expect(await json(await ask("And tomorrow?", history))).toMatchObject({ kind: "reply" });
    const prompt = model.calls[0].prompt;
    expect(prompt).not.toMatch(/Riya|Rahul|Neha/);
    expect(prompt).toMatch(/Can \{d\d\} play at 4 pm\?/);
    expect(prompt).toMatch(/\{m2\} and \{m1\} can take \{d\d\} to the park/);
  });

  it("swaps a stored Latin name typed in Devanagari (रिया, नेहा)", async () => {
    const { ask, model } = await setup();
    await ask("रिया और नेहा कब बाहर जाएँ?");
    expect(model.calls[0].prompt).not.toMatch(/रिया|नेहा/);
  });

  it("answers an emergency with Call 112 even after the per-minute limit", async () => {
    const { ask, model } = await setup();
    for (let i = 0; i < 5; i++) await ask("Hi");
    expect((await ask("Hi")).status).toBe(429);
    expect(await json(await ask("Neha is short of breath"))).toEqual({ kind: "emergency" });
    expect(model.calls).toHaveLength(5);
  });
});

describe("POST /api/breezy: refusals", () => {
  it("passes admin_action on with its cards, and drops the cards of off_topic and other", async () => {
    const admin = await setup(() => reply("You can do that in Family settings.", [TRIP], "en", "admin_action"));
    expect(await json(await admin.ask("Remove Rahul"))).toMatchObject({ refusal: "admin_action", cards: [expect.anything()] });
    for (const refusal of ["off_topic", "other"] as const) {
      const { ask } = await setup(() => reply("I can only help with the air today.", [TRIP], "en", refusal));
      expect(await json(await ask("Tell me a joke"))).toMatchObject({ kind: "reply", refusal, cards: [] });
    }
  });
});

describe("POST /api/breezy/action: forged bodies", () => {
  const checklist = (forId: string, item: object, over: object = {}) => ({
    type: "add_checklist",
    forId,
    date: "today",
    time: null,
    activity: null,
    item,
    ...over,
  });

  it("refuses an outing at an hour the rules refuse, inside a checklist item's text", async () => {
    const { act, riya } = await setup();
    const res = await act(checklist(riya, { en: "Play outside at 8 am", hi: "सुबह 8 बजे बाहर खेलें" }));
    expect(res.status).toBe(400);
    const plan = { type: "add_to_plan", forId: "neha", date: "today", time: "15:00", activity: "walk" };
    expect((await act({ ...plan, item: { en: "Walk at 6 am", hi: "सुबह 6 बजे सैर" } })).status).toBe(400);
    expect((await act({ ...plan, item: { en: "Walk at 8 am", hi: "सुबह 8 बजे सैर" } })).status).toBe(200);
  });

  it("refuses an unknown fact id and a why field, and stores neither", async () => {
    const { act, app } = await setup();
    const item = { en: "Carry the inhaler today", hi: "आज इनहेलर साथ रखें" };
    expect((await act(checklist("rahul", item, { factId: "made_up" }))).status).toBe(400);
    expect((await act(checklist("rahul", item, { why: "Neha has asthma" }))).status).toBe(400);
    expect((await act(checklist("rahul", item, { factId: "n95_fit" }))).status).toBe(200);
    const stored = [...app.db.docs.entries()].filter(([path]) => path.includes("/items/")).map(([, doc]) => doc);
    expect(stored).toEqual([expect.objectContaining({ factId: "n95_fit" })]);
    expect(stored[0]).not.toHaveProperty("why");
  });
});
