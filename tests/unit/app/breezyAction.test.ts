import { describe, expect, it } from "vitest";
import { breezyAction } from "@/server/handlers/breezyAction";
import { loadMember } from "@/server/app/todayPage";
import { loadKidCard } from "@/server/app/kidCardPage";
import { loadViewer } from "@/server/app/viewer";
import { json, request, testApp } from "../../helpers/appDeps";
import { addRiya, joins, sharmaFamily } from "../../helpers/family";

/** `POST /api/breezy/action` (spec 7.7.4, 9.3): the server checks the target, the words and the rules again. */
const item = { en: "Carry the inhaler today", hi: "आज इनहेलर साथ रखें" };
const checklist = (forId: string, over: object = {}) => ({
  type: "add_checklist",
  forId,
  date: "today",
  time: null,
  activity: null,
  item,
  ...over,
});

async function setup() {
  const app = testApp();
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  const riya = await addRiya(app);
  const act = (body: object, uid = "rahul") => breezyAction(request("/api/breezy/action", { uid, body }), app.deps);
  const inFamily = async (uid: string) => {
    const viewer = await loadViewer(`session:${uid}`, app.deps);
    if (viewer.kind !== "signed_in" || !viewer.bundle) throw new Error("not in family");
    return { ...viewer, bundle: viewer.bundle };
  };
  return { app, fid, riya, act, inFamily };
}

describe("POST /api/breezy/action", () => {
  it("adds to another member's checklist, 'added by Rahul', with the WhatsApp text", async () => {
    const { act, app, inFamily } = await setup();
    const response = await act(checklist("neha"));
    expect(await json(response)).toEqual({
      ok: true,
      onCard: true,
      whatsapp: "Neha, a reminder for today: Carry the inhaler today – Rahul",
    });
    const page = await loadMember(await inFamily("neha"), "neha", app.deps);
    expect(page?.checklist).toEqual([expect.objectContaining({ text: "Carry the inhaler today", addedByName: "Rahul", done: false })]);
  });

  it("gives no WhatsApp text for yourself", async () => {
    const { act } = await setup();
    expect(await json(await act(checklist("rahul")))).toMatchObject({ whatsapp: null });
  });

  it("puts a dependent's item on the kid card only when it passes the kid-card checks", async () => {
    const { act, app, riya, inFamily } = await setup();
    expect(await json(await act(checklist(riya, { item: { en: "Carry your water bottle", hi: "पानी की बोतल साथ रखें" } })))).toMatchObject({
      onCard: true,
      whatsapp: null,
    });
    expect(await json(await act(checklist(riya, { item: { en: "Pack 2 masks", hi: "2 मास्क रखें" } })))).toMatchObject({ onCard: false });
    const smoking = { en: "No smoking near you today, play inside", hi: "आज अंदर खेलें" };
    expect(await json(await act(checklist(riya, { item: smoking })))).toMatchObject({ ok: true, onCard: false });
    const card = await loadKidCard(await inFamily("neha"), riya, app.deps);
    expect(card?.kid?.checklist?.map((i) => i.text)).toEqual(["Carry your water bottle"]);
  });

  it("adds a plan item at a time the rules allow, shown with its time", async () => {
    const { act, app, inFamily } = await setup();
    const body = {
      type: "add_to_plan",
      forId: "neha",
      date: "today",
      time: "15:00",
      activity: "temple_errand",
      item: { en: "Temple visit", hi: "मंदिर जाएँ" },
    };
    expect((await act(body)).status).toBe(200);
    const page = await loadMember(await inFamily("neha"), "neha", app.deps);
    expect(page?.checklist[0].text).toBe("3 pm · Temple visit");
  });

  it("refuses a time the rules no longer allow, and a plan item without a time", async () => {
    const { act, riya } = await setup();
    const sport = {
      type: "add_to_plan",
      forId: riya,
      date: "today",
      time: "16:00",
      activity: "sport",
      item: { en: "Cricket", hi: "क्रिकेट" },
    };
    const refused = await act(sport);
    expect(refused.status).toBe(409);
    expect(await json(refused)).toMatchObject({ error: { code: "rules_changed" } });
    expect((await act({ ...sport, time: null })).status).toBe(409);
  });

  it("checks the words again: names, numbers, cigarettes and the wrong language are refused", async () => {
    const { act } = await setup();
    for (const bad of [
      { en: "Neha, carry the inhaler", hi: "इनहेलर रखें" },
      { en: "AQI is 341, stay in", hi: "घर में रहें" },
      { en: "Like 11 cigarettes", hi: "घर में रहें" },
      { en: "Carry the inhaler", hi: "Carry the inhaler" },
    ])
      expect((await act(checklist("neha", { item: bad }))).status).toBe(400);
  });

  it("refuses people outside the family, strangers and a forged type", async () => {
    const { act } = await setup();
    expect((await act(checklist("someone-else"))).status).toBe(403);
    expect((await act(checklist("neha"), "stranger")).status).toBe(403);
    expect((await act(checklist("neha", { type: "remove_member" }))).status).toBe(400);
  });
});
