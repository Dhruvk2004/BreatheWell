import { describe, expect, it } from "vitest";
import type { ValidCard } from "@/ai/breezy/validate";
import { resolveCard, resolveCards } from "@/server/breezy/cards";
import { card, demoContext } from "../../helpers/breezy";

/** Cards as shown: ids for tokens, names filled in, the rules run again for every time. */
const ctx = demoContext();
const valid = (over: Parameters<typeof card>[0] = {}): ValidCard => {
  const { forMemberId, ...rest } = card(over);
  return { ...rest, forToken: forMemberId };
};

describe("resolveCard", () => {
  it("keeps an allowed time with the rule's chip, never Gemini's (Dadaji, Light, 3 pm)", () => {
    expect(resolveCard(valid({ title: "Temple visit for {m3}" }), ctx)).toMatchObject({
      forId: "dadaji",
      title: "Temple visit for Dadaji",
      time: "15:00",
    });
    expect(resolveCard(valid(), ctx)?.verdict).not.toBe("avoid");
  });

  it("moves an Avoid hour to the best hour when the words name no time, and drops it when they do", () => {
    const words = { title: "Morning walk", why: "Slow and steady.", item: { en: "Morning walk", hi: "सुबह की सैर" } };
    const moved = resolveCard(valid({ ...words, time: "07:00", activityType: "walk" }), ctx);
    expect(moved?.time).not.toBe("07:00");
    expect(moved?.verdict).not.toBe("avoid");
    expect(resolveCard(valid({ time: "07:00", activityType: "walk", title: "Walk at 7 am" }), ctx)).toBeNull();
  });

  it("drops a card for an activity that is Avoid all day (Severe day)", () => {
    const severe = demoContext("severe-day");
    const words = { title: "Cricket", why: "Fun.", item: { en: "Cricket", hi: "क्रिकेट" } };
    expect(resolveCard(valid({ ...words, forMemberId: "d1", activityType: "sport", time: "16:00" }), severe)).toBeNull();
  });

  it("gives a checklist card no chip, and says whether a dependent's item may go on the kid card", () => {
    const masks = valid({
      forMemberId: "d2",
      action: "add_checklist",
      time: null,
      activityType: null,
      item: { en: "Pack 2 masks", hi: "2 मास्क रखें" },
    });
    expect(resolveCard(masks, ctx)).toMatchObject({ forId: "riya", verdict: null, time: null, onCard: false });
    const bottle = valid({
      forMemberId: "d2",
      action: "add_checklist",
      time: null,
      activityType: null,
      item: { en: "Carry your water bottle", hi: "पानी की बोतल रखें" },
    });
    expect(resolveCard(bottle, ctx)?.onCard).toBe(true);
  });

  it("keeps a dependent's item with a cigarette comparison and no number off the kid card", () => {
    const base = { forMemberId: "d2", action: "add_checklist" as const, time: null, activityType: null };
    const en = valid({ ...base, item: { en: "Like smoking today, so play inside", hi: "आज अंदर खेलें" } });
    const hi = valid({ ...base, item: { en: "Play inside today", hi: "आज सिगरेट जैसी हवा है" } });
    expect(resolveCard(en, ctx)?.onCard).toBe(false);
    expect(resolveCard(hi, ctx)?.onCard).toBe(false);
  });

  it("asks who a timed card is for, with each person's rule slot (null where it cannot be added)", () => {
    const shown = resolveCard(
      valid({ forMemberId: null, time: "07:00", activityType: "walk", title: "Walk", why: "", item: { en: "Walk", hi: "सैर" } }),
      ctx,
    );
    expect(shown?.forId).toBeNull();
    expect(Object.keys(shown?.slots ?? {})).toEqual(ctx.day.rows.map((r) => r.person.id));
    for (const slot of Object.values(shown?.slots ?? {})) if (slot) expect(slot.verdict).not.toBe("avoid");
    const named = resolveCard(valid({ forMemberId: null, time: "07:00", activityType: "walk", title: "Walk at 7 am" }), ctx);
    expect(Object.values(named?.slots ?? {}).every((s) => s === null || s.time === "07:00")).toBe(true);
  });

  it("plans tomorrow from midnight and keeps half hours", () => {
    expect(resolveCard(valid({ date: "tomorrow", time: "15:30" }), ctx)).toMatchObject({ date: "tomorrow", time: "15:30" });
  });

  it("keeps the cards that survive, in order", () => {
    const words = { title: "Walk", why: "", item: { en: "Walk", hi: "सैर" } };
    expect(resolveCards([valid(), valid({ ...words, forMemberId: "d1", activityType: "sport", time: "16:00" })], ctx)).toHaveLength(2);
  });
});
