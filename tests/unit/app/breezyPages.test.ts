import { describe, expect, it } from "vitest";
import { yourDay } from "@/domain/impact/yourDay";
import { loadBreezy } from "@/server/app/breezyPage";
import { loadYourDay } from "@/server/app/learnPage";
import { loadToday } from "@/server/app/todayPage";
import { loadViewer } from "@/server/app/viewer";
import { recordedDemo } from "@/server/demo/demoPage";
import { deps as airDeps } from "../../helpers/airDeps";
import { testApp } from "../../helpers/appDeps";
import { addRiya, joins, sharmaFamily } from "../../helpers/family";
import { fakeModel } from "../../helpers/planReply";

/** Breezy's page (spec 10.10), Learn's "Your choices today" (10.11) and Today's links (10.8, 10.13). */
async function family(over = {}) {
  const app = testApp(over);
  const { code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  await addRiya(app);
  const viewer = await loadViewer("session:neha", app.deps);
  if (viewer.kind !== "signed_in" || !viewer.bundle) throw new Error("no family");
  return { app, viewer: { ...viewer, bundle: viewer.bundle } };
}

describe("loadBreezy", () => {
  it("lists the people, the air time and the rules' basics", async () => {
    const { app, viewer } = await family({ gemini: fakeModel(() => "{}") });
    const page = await loadBreezy(viewer, app.deps, "en");
    expect(page).toMatchObject({
      viewerId: "neha",
      viewerName: "Neha",
      place: "Green Park, New Delhi",
      updated: "6:10 am",
      configured: true,
    });
    expect(page.people.map((p) => p.name)).toEqual(["Neha", "Rahul", "Riya"]);
    expect(page.basics[0]).toMatchObject({ id: "neha", name: "Neha", verdict: expect.any(String), line: expect.any(String) });
  });

  it("has no basics and no time without air", async () => {
    const { app, viewer } = await family({ air: airDeps({ fetchAir: async () => ({ ok: false as const, error: "network" as const }) }) });
    const page = await loadBreezy(viewer, app.deps, "hi");
    expect(page).toMatchObject({ updated: null, basics: [], people: [], configured: false });
  });
});

describe("Learn: your choices today (spec 10.11)", () => {
  it("compares outside all day with the plan for a signed-in adult", async () => {
    const { app, viewer } = await family();
    const day = await loadYourDay(viewer, app.deps);
    expect(day?.outside.count).toBeGreaterThanOrEqual(day?.withPlan.count ?? 0);
  });

  it("is null for visitors and without air", async () => {
    const { app } = await family();
    expect(await loadYourDay({ kind: "signed_out" }, app.deps)).toBeNull();
    const { app: noAir, viewer } = await family({
      air: airDeps({ fetchAir: async () => ({ ok: false as const, error: "network" as const }) }),
    });
    expect(await loadYourDay(viewer, noAir.deps)).toBeNull();
  });

  it("counts the CO₂ of the plan's mode switch (Neha on a Severe day: scooter to metro)", () => {
    const data = recordedDemo("severe-day", 6, "neha");
    const neha = data.day.rows.find((r) => r.person.id === "neha");
    if (!neha) throw new Error("no row");
    const day = yourDay(neha, data.day.summary.index, data.day.summary.date, false);
    expect(day?.co2Kg).toBeGreaterThan(0);
    expect(yourDay(neha, data.day.summary.index, "2001-01-01", true)).toBeNull();
  });
});

describe("Today links", () => {
  it("links to the community message for the family's home area", async () => {
    const { app, viewer } = await family();
    expect((await loadToday(viewer, app.deps)).communityHref).toBe("/community?place=Green+Park%2C+New+Delhi&lat=28.56&lon=77.21");
  });
});

describe("breezyContext", () => {
  it("has no viewer token for someone the rules do not plan", async () => {
    const { breezyContext } = await import("@/server/breezy/context");
    const { planFamilyToday } = await import("@/server/app/familyPlan");
    const { app, viewer } = await family();
    const planned = await planFamilyToday(viewer.bundle, "neha", app.deps.air);
    expect(breezyContext(viewer.bundle, planned, "nobody", "en")?.check.input.viewer).toBeNull();
    expect(breezyContext(viewer.bundle, planned, "neha", "en")?.people.map((p) => p.kind)).toEqual(["adult", "adult", "dependent"]);
  });
});
