import { describe, expect, it } from "vitest";
import { breezyCheck } from "@/ai/breezy/input";
import { outlookInput } from "@/ai/breezy/schema";
import { basicsRows } from "@/ai/breezy/template";
import { addedLine, addLabel, confirmNote, confirmTitle, whenLine, type Target } from "@/components/breezy/cardText";
import { demoPlanCheck } from "@/server/demo/demoPlan";
import { recordedDemo } from "@/server/demo/demoPage";
import { addItem } from "@/server/repos/breezyItems";
import { NOW } from "../../helpers/airDeps";
import { testApp } from "../../helpers/appDeps";
import { joins, sharmaFamily } from "../../helpers/family";

/** The smaller branches of Breezy's pieces: missing hours and windows, no headline, every card sentence. */
const data = recordedDemo("smog-morning", 6, "neha");

describe("Breezy input and template edges", () => {
  it("sends missing hours as null bands and an outlook day without a window as null", () => {
    const plan = demoPlanCheck(data.day, data.weather);
    if (!plan) throw new Error("no plan");
    const summary = { ...data.day.summary, today: [null, ...data.day.summary.today.slice(1)] };
    const check = breezyCheck({ plan, summary, viewer: null, viewerLanguage: "hi", allowed: () => true });
    expect(check.input.todayBands[0]).toBeNull();
    expect(check.input.viewer).toBeNull();
    expect(outlookInput([{ ...data.day.summary.outlook[0], best: null }])[0].bestWindow).toBeNull();
  });

  it("leaves out people without a planned activity from the basics", () => {
    const rows = data.day.rows.map((r, i) => (i === 0 ? { ...r, headline: null } : r));
    expect(basicsRows(rows, "en").map((r) => r.id)).not.toContain(rows[0].person.id);
  });
});

describe("card sentences (no pronouns)", () => {
  const me: Target = { id: "neha", name: "Neha", kind: "adult", self: true };
  const kid: Target = { id: "riya", name: "Riya", kind: "dependent", self: false };
  const plan = { action: "add_to_plan" as const, date: "tomorrow" as const, title: "Walk", onCard: false };

  it("says when, add, confirm and added for yourself, a member and a child", () => {
    expect(whenLine({ date: "tomorrow", time: "15:30" }, "en")).toBe("Tomorrow, 3:30 pm");
    expect(whenLine({ date: "tomorrow", time: null }, "hi")).toBe("कल");
    expect(addLabel(plan, me, "en")).toBe("Add to my plan");
    expect(confirmTitle({ ...plan, action: "add_checklist" }, kid, "en")).toBe('Add "Walk" to Riya\'s checklist for tomorrow?');
    expect(confirmNote(plan, kid, "en")).toBe("This will show on your view only, not on Riya's card.");
    expect(addedLine(plan, me, true, "en")).toBe("Added to your plan.");
    expect(addedLine({ action: "add_checklist" }, me, true, "en")).toBe("Added to your checklist.");
    expect(addedLine(plan, kid, false, "en")).toBe("Added to Riya's list on your view. It's not on Riya's card.");
    expect(addedLine(plan, kid, true, "en")).toBe("Added to Riya's plan. It's on Riya's kid card.");
    expect(addedLine(plan, { ...kid, kind: "adult" }, true, "en")).toBe("Added to Riya's plan. Riya will see it in BreatheWell.");
  });
});

describe("addItem", () => {
  it("writes tomorrow's checklist item without a time, kept 30 days after its date", async () => {
    const app = testApp();
    const { db } = app;
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    const body = {
      type: "add_checklist" as const,
      forId: "neha",
      date: "tomorrow" as const,
      time: "15:00",
      activity: null,
      item: { en: "a", hi: "क" },
      why: "",
      factId: null,
    };
    const id = await addItem(db, fid, { body, forId: "neha", by: { uid: "rahul", name: "Rahul" }, now: NOW });
    expect(db.docs.get(`families/${fid}/items/${id}`)).toMatchObject({
      date: "2024-11-19",
      time: null,
      kind: "checklist",
      expireAt: "2024-12-19T00:00:00.000Z",
    });
  });

  it("writes nothing when the adder or the person is no longer in the family (stage 7 AUTH-4)", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    const body = { type: "add_checklist" as const, forId: "neha", date: "today" as const, time: null, activity: null };
    const item = { body: { ...body, item: { en: "a", hi: "क" }, why: "", factId: null }, now: NOW };
    expect(await addItem(app.db, fid, { ...item, forId: "neha", by: { uid: "stranger", name: "S" } })).toBeNull();
    expect(await addItem(app.db, fid, { ...item, forId: "gone", by: { uid: "rahul", name: "Rahul" } })).toBeNull();
    expect([...app.db.docs.keys()].some((k) => k.startsWith(`families/${fid}/items/`))).toBe(false);
  });
});
