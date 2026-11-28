import { describe, expect, it } from "vitest";
import { breezyAction } from "@/server/handlers/breezyAction";
import { loadKidCard } from "@/server/app/kidCardPage";
import { loadViewer } from "@/server/app/viewer";
import { removeMember } from "@/server/handlers/members";
import type { Tx } from "@/server/db/types";
import { json, request, testApp } from "../../helpers/appDeps";
import { addRiya, joins, RIYA, sharmaFamily } from "../../helpers/family";

/** `POST /api/breezy/action`: the card's language, the same safety checks as the reply, and membership checked on write. */
const checklist = (forId: string, item: { en: string; hi: string }) => ({
  type: "add_checklist",
  forId,
  date: "today",
  time: null,
  activity: null,
  item,
});

async function setup() {
  const app = testApp();
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  const riya = await addRiya(app);
  const act = (body: object, uid = "rahul") => breezyAction(request("/api/breezy/action", { uid, body }), app.deps);
  const kidCard = async (id: string) => {
    const viewer = await loadViewer("session:neha", app.deps);
    if (viewer.kind !== "signed_in" || !viewer.bundle) throw new Error("not in family");
    return loadKidCard({ ...viewer, bundle: viewer.bundle }, id, app.deps);
  };
  return { app, fid, riya, act, kidCard };
}

describe("onCard follows the kid card's own language", () => {
  it("an English card shows a clean English item even when the Hindi text fails, and says so", async () => {
    const { act, riya, kidCard } = await setup();
    const response = await act(checklist(riya, { en: "Carry your water bottle", hi: "बीमार हो तो बताना" }));
    expect(await json(response)).toMatchObject({ ok: true, onCard: true });
    expect((await kidCard(riya))?.kid?.checklist?.map((i) => i.text)).toContain("Carry your water bottle");
  });

  it("a Hindi card leaves a Hindi health item off the card, and says so", async () => {
    const { act, app } = await setup();
    const kid = await addRiya(app, "neha", { ...RIYA, name: "Meera", cardLanguage: "hi" });
    const response = await act(checklist(kid, { en: "Carry your water bottle", hi: "दवाई साथ रखें" }));
    expect(await json(response)).toMatchObject({ ok: true, onCard: false });
  });
});

describe("the action route runs the same checks as the reply", () => {
  it.each([
    { en: "Play outside at eight am", hi: "आज अंदर खेलें" },
    { en: "Play inside today", hi: "सुबह ८ बजे बाहर खेलें" },
  ])("refuses an outing at an Avoid hour written as %o", async (item) => {
    const { act, riya } = await setup();
    expect((await act(checklist(riya, item))).status).toBe(400);
  });

  it("refuses medicine-stopping advice and short links for the grandparent or anyone", async () => {
    const { act } = await setup();
    expect((await act(checklist("neha", { en: "Leave the inhaler at home today", hi: "आज इनहेलर की ज़रूरत नहीं" }))).status).toBe(400);
    expect((await act(checklist("neha", { en: "Book a test at labdeal.xyz today", hi: "आज जाँच करवाएँ" }))).status).toBe(400);
    expect((await act(checklist("neha", { en: "Today is like smoking ten a day, stay in", hi: "आज अंदर रहें" }))).status).toBe(400);
  });

  it("keeps worded durations and health words off a kid card", async () => {
    const { act, riya } = await setup();
    expect(await json(await act(checklist(riya, { en: "Play inside for ten minutes", hi: "दस मिनट अंदर खेलें" })))).toMatchObject({
      onCard: false,
    });
    expect(await json(await act(checklist(riya, { en: "Carry your medicines", hi: "दवाइयाँ ले जाएँ" })))).toMatchObject({ onCard: false });
  });
});

describe("membership is checked in the writing transaction", () => {
  it("an action in flight when the adder is removed writes nothing", async () => {
    const { app, fid, act } = await setup();
    const realTx = app.db.transaction.bind(app.db);
    let armed = true;
    app.db.transaction = (async <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => {
      if (armed) {
        armed = false;
        const removed = await removeMember(request("/api/family/members/rahul", { method: "DELETE", uid: "neha" }), app.deps, "rahul");
        expect(removed.status).toBe(200);
      }
      return realTx(fn);
    }) as typeof app.db.transaction;
    expect((await act(checklist("neha", { en: "Carry your water bottle", hi: "पानी की बोतल साथ रखें" }))).status).toBe(403);
    app.db.transaction = realTx;
    expect([...app.db.docs.keys()].some((k) => k.startsWith(`families/${fid}/items/`))).toBe(false);
  });
});
