import { describe, expect, it } from "vitest";
import type { ValidCard } from "@/ai/breezy/validate";
import { ApiRequestError } from "@/client/api";
import { failureText } from "@/components/ui/failure";
import { indexHours, type HourPoint } from "@/domain/air/hourly";
import { cardPicture } from "@/domain/impact/cardPicture";
import { loadYourDay } from "@/server/app/learnPage";
import { loadViewer } from "@/server/app/viewer";
import { resolveCard, resolveCards } from "@/server/breezy/cards";
import { breezyContext } from "@/server/breezy/context";
import { hourAllowedFor } from "@/server/breezy/slot";
import { askBreezy } from "@/server/handlers/breezy";
import { isQuotaExhausted, pausedOnQuota } from "@/server/http";
import { deps as airDeps } from "../../helpers/airDeps";
import { json, request, testApp } from "../../helpers/appDeps";
import { card, demoContext } from "../../helpers/breezy";
import { sharmaFamily } from "../../helpers/family";
import { fakeModel } from "../../helpers/planReply";

/** Breezy's smaller branches: saving paused, card pictures, slot judging, missing air and demo edges. */
const ctx = demoContext();
const valid = (over: Parameters<typeof card>[0] = {}): ValidCard => {
  const { forMemberId, ...rest } = card(over);
  return { ...rest, forToken: forMemberId };
};
const NO_AIR = airDeps({ fetchAir: async () => ({ ok: false as const, error: "network" as const }) });

describe("Saving paused (Firestore resource-exhausted)", () => {
  it("recognises the quota error in its three shapes and nothing else", () => {
    expect(isQuotaExhausted({ code: 8 })).toBe(true);
    expect(isQuotaExhausted({ code: "resource-exhausted" })).toBe(true);
    expect(isQuotaExhausted(new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."))).toBe(true);
    expect(isQuotaExhausted(new Error("boom"))).toBe(false);
    expect(isQuotaExhausted(null)).toBe(false);
  });

  it("turns it into 503 saving_paused, passes answers through and rethrows other errors", async () => {
    const paused = await pausedOnQuota(Promise.reject({ code: 8 }));
    expect(paused.status).toBe(503);
    expect(await json(paused)).toMatchObject({ error: { code: "saving_paused" } });
    expect((await pausedOnQuota(Promise.resolve(new Response("ok")))).status).toBe(200);
    await expect(pausedOnQuota(Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });

  it("words it for the page", () => {
    const paused = new ApiRequestError(503, "saving_paused", "x", {});
    expect(failureText(paused, "en", "common.error")).toBe("Saving is paused until tomorrow; your plan and the air still show.");
    expect(failureText(new TypeError("offline"), "en", "common.error")).toBe("Something went wrong. Try again.");
  });
});

describe("cardPicture", () => {
  const point = (hour: number, pm25: number | null): HourPoint => ({
    time: `2024-11-18T${String(hour).padStart(2, "0")}:00`,
    date: "2024-11-18",
    hour,
    aqi: 300,
    band: "very_poor",
    main: "pm25",
    pm25,
    pm10: null,
  });
  const day = (pm: (h: number) => number | null) => indexHours(Array.from({ length: 24 }, (_, h) => point(h, pm(h))));

  it("compares the hour with the day's smokiest one, and gives the whole-day figure", () => {
    const index = day((h) => (h === 7 ? 300 : 100));
    expect(cardPicture(index, "2024-11-18", 15, 1)).toEqual({ lessPercent: 70, thanHour: 7, dayOutside: { count: 5, lessThanOne: false } });
    expect(cardPicture(index, "2024-11-18", 7, 1)?.lessPercent).toBe(0);
  });

  it("is null without a full day, and skips windows that run past midnight or miss data", () => {
    expect(
      cardPicture(
        day((h) => (h === 3 ? null : 100)),
        "2024-11-18",
        15,
        1,
      ),
    ).toBeNull();
    const evening = day(() => 100);
    expect(cardPicture(evening, "2024-11-18", 23, 2)).toBeNull();
    expect(cardPicture(evening, "2024-11-18", 21, 2)?.thanHour).toBe(21);
  });
});

describe("slot judge, context and cards", () => {
  it("allows nothing without a planned day or for an unknown person, and maps tokens to ids", () => {
    expect(hourAllowedFor(null)("neha", "walk", "today", 15)).toBe(false);
    const allowed = hourAllowedFor({ day: ctx.day, ctx: ctx.ctx }, ctx.idOf);
    expect(allowed("nobody", "walk", "today", 15)).toBe(false);
    expect(allowed("m3", "temple_errand", "today", 15)).toBe(allowed("dadaji", "temple_errand", "today", 15));
  });

  it("keeps a card whose token has no person as 'Who is this for?', with no picture on a dependent's card", () => {
    expect(resolveCard({ ...valid(), forToken: "m9" }, ctx)?.slots).toBeDefined();
    expect(resolveCard(valid({ forMemberId: "d2", activityType: "temple_errand", time: "15:00" }), ctx)?.picture).toBeUndefined();
    expect(resolveCard(valid(), ctx)?.picture).toMatchObject({ dayOutside: expect.any(Object) });
  });

  it("drops cards the rules drop, and gives no picture when the day's PM2.5 is missing", () => {
    const words = { title: "Walk at 7 am", activityType: "walk" as const, time: "07:00" };
    expect(resolveCards([valid(words), valid()], ctx)).toHaveLength(1);
    const index = new Map([...ctx.day.summary.index].map(([k, p]) => [k, { ...p, pm25: null }]));
    const blind = { ...ctx, day: { ...ctx.day, summary: { ...ctx.day.summary, index } } };
    expect(resolveCard(valid(), blind)?.picture).toBeUndefined();
  });
});

describe("handlers without air", () => {
  it("still asks who 'Papa' is, and gives the basics, when there is no air data", async () => {
    const app = testApp({ gemini: fakeModel(() => "{}"), air: NO_AIR });
    await sharmaFamily(app);
    const ask = async (question: string) => json(await askBreezy(request("/api/breezy", { uid: "neha", body: { question } }), app.deps));
    expect(await ask("Can Papa walk?")).toMatchObject({ kind: "ask_alias", word: "Papa" });
    expect(await ask("Hi")).toEqual({ kind: "basics" });
  });

  it("has no Breezy context or Learn day without a planned day, and uses the careful home without a set-up", async () => {
    const app = testApp();
    await sharmaFamily(app);
    const viewer = await loadViewer("session:neha", app.deps);
    if (viewer.kind !== "signed_in" || !viewer.bundle) throw new Error("no family");
    const bundle = viewer.bundle;
    expect(breezyContext(bundle, { snapshot: null, day: null, region: "igp", stationNote: false }, "neha", "en")).toBeNull();
    expect(await loadYourDay({ ...viewer, bundle: { ...bundle, homeSetup: null } }, app.deps)).not.toBeNull();
  });
});

describe("small paths", () => {
  it("checks a reply with no viewer token against everyone", async () => {
    const { validateBreezy } = await import("@/ai/breezy/validate");
    const { reply } = await import("../../helpers/breezy");
    const nobody = { ...ctx.check, input: { ...ctx.check.input, viewer: null } };
    expect(validateBreezy(reply("Keep the windows shut this morning."), nobody)).not.toBeNull();
  });

  it("words the add buttons and the added lines for every target", async () => {
    const { addLabel, addedLine } = await import("@/components/breezy/cardText");
    const self = { id: "neha", name: "Neha", kind: "adult" as const, self: true };
    const kid = { id: "riya", name: "Riya", kind: "dependent" as const, self: false };
    expect(addLabel({ action: "add_checklist" }, self, "en")).toBe("Add to my checklist");
    expect(addedLine({ action: "add_to_plan" }, kid, true, "en")).toBe("Added to Riya's plan. It's on Riya's kid card.");
  });

  it("adds a checklist item without air data (no times to judge)", async () => {
    const { breezyAction } = await import("@/server/handlers/breezyAction");
    const app = testApp({ air: NO_AIR });
    await sharmaFamily(app);
    const body = {
      type: "add_checklist",
      forId: "neha",
      date: "today",
      time: null,
      activity: null,
      item: { en: "Carry the inhaler", hi: "इनहेलर साथ रखें" },
    };
    expect((await breezyAction(request("/api/breezy/action", { uid: "neha", body }), app.deps)).status).toBe(200);
  });
});

describe("demo Breezy edges", () => {
  it("uses the code's answers on live data, and has no context without a plan check", async () => {
    const { demoBreezyContext, demoChips } = await import("@/server/demo/demoBreezy");
    const { recordedDemo } = await import("@/server/demo/demoPage");
    const data = recordedDemo("smog-morning", 6, "neha");
    const live = demoChips({ scenario: "live", time: 6, view: "neha" }, { ...data, source: "live" }, "en");
    expect(live.every((c) => c.source === "template")).toBe(true);
    const empty = { ...data, day: { ...data.day, rows: [] } };
    expect(demoBreezyContext(empty, "en")).toBeNull();
  });
});

describe("reply contradictions", () => {
  it("finds no outing words for an indoor activity type that has none", async () => {
    const { replyContradictions } = await import("@/ai/breezy/contradiction");
    const severe = demoContext("severe-day").check.input.people;
    const person = severe.find((p) => p.activities.some((a) => a.rule.suggestion === "indoor"));
    if (!person) throw new Error("no indoor activity");
    const moved = { ...person, activities: person.activities.map((a) => ({ ...a, type: "school_trip" as const })) };
    expect(replyContradictions(`{${person.id}} can relax at 3 pm.`, [moved], null)).toEqual([]);
  });
});
