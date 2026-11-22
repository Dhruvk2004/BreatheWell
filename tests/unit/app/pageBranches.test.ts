import { describe, expect, it } from "vitest";
import { loadDependent } from "@/server/app/dependentPage";
import { planFamilyToday } from "@/server/app/familyPlan";
import type { InFamily, SignedIn } from "@/server/app/guards";
import { loadMember, loadToday } from "@/server/app/todayPage";
import { loadViewer } from "@/server/app/viewer";
import { requestPlan } from "@/server/handlers/plan";
import { claimPlan, readStoredPlan, savePlan } from "@/server/repos/plans";
import { NOW } from "../../helpers/airDeps";
import { request, testApp, type TestApp } from "../../helpers/appDeps";
import { addRiya, joins, sharmaFamily } from "../../helpers/family";
import { fakeModel, replyToPrompt } from "../../helpers/planReply";

/** Today, Member plan and dependent pages when a piece of the family is missing (never a throw). */
const DATE = "2024-11-18";
const inFamily = async (app: TestApp, uid: string) => (await loadViewer(`session:${uid}`, app.deps)) as SignedIn as InFamily;

async function planned() {
  const app = testApp({ gemini: fakeModel((r) => replyToPrompt(r.prompt)) });
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  const riya = await addRiya(app);
  await requestPlan(request("/api/plan", { uid: "neha", body: {} }), app.deps);
  return { app, fid, riya };
}

describe("member and today pages with gaps", () => {
  it("shows Gemini's swap without a why, and plans a family without a home setup", async () => {
    const { app, fid } = await planned();
    const path = `families/${fid}/plans/${DATE}/members/neha`;
    app.db.docs.set(path, { ...app.db.docs.get(path), swap: { altId: "metro_for_scooter", doThis: { en: "{m1}: metro today." } } });
    const viewer = await inFamily(app, "neha");
    const page = await loadMember({ ...viewer, bundle: { ...viewer.bundle, homeSetup: null } }, "neha", app.deps);
    expect(page?.swap).toEqual({ altId: "metro_for_scooter", words: { doThis: "Neha: metro today." } });
  });

  it("writes the share text in the viewer's language when no admin is found", async () => {
    const { app } = await planned();
    const viewer = await inFamily(app, "rahul");
    const family = { ...viewer.bundle.family, adminUid: "gone" };
    const page = await loadToday({ ...viewer, bundle: { ...viewer.bundle, family } }, app.deps, "hi");
    expect(page.shareText).toMatch(/हवा/);
    expect(page.joinCards).toEqual([]);
  });

  it("names the viewer as guardian from their account when their member record is missing", async () => {
    const { app } = await planned();
    const viewer = await inFamily(app, "rahul");
    const page = loadDependent({ ...viewer, bundle: { ...viewer.bundle, members: [] } }, null);
    expect(page?.guardianName).toBe(viewer.user.name);
  });

  it("shows no station note for a place in India that is not a listed city", async () => {
    const { app } = await planned();
    const { bundle } = await inFamily(app, "neha");
    const home = { ...bundle.family.home, lat2: 25.1, lon2: 80.3 };
    const day = await planFamilyToday({ ...bundle, family: { ...bundle.family, home } }, "neha", app.deps.air);
    expect(day.region).not.toBe("outside_india");
    expect(day.stationNote).toBe(false);
  });
});

describe("plan storage with bad docs", () => {
  it("drops a section that fails its schema and reads a broken plan doc as none", async () => {
    const { app, fid } = await planned();
    app.db.docs.set(`families/${fid}/plans/${DATE}/members/junk`, { line: 7 });
    const stored = await readStoredPlan(app.db, fid, DATE);
    expect(stored?.sections).not.toHaveProperty("junk");
    expect(Object.keys(stored?.sections ?? {}).length).toBeGreaterThan(0);
    app.db.docs.set(`families/${fid}/plans/${DATE}`, { generations: "many" });
    expect(await readStoredPlan(app.db, fid, DATE)).toBeNull();
    expect(await claimPlan(app.db, fid, DATE, NOW, false)).toEqual({ kind: "claimed", since: NOW.toISOString() });
  });

  it("deletes the sections of people no longer in the new plan", async () => {
    const { app, fid, riya } = await planned();
    const result = {
      source: "template" as const,
      outcome: "invalid",
      now: NOW,
      doc: { languages: ["en" as const], tokens: {}, home: [], together: null },
      sections: {},
    };
    await savePlan(app.db, fid, DATE, result);
    expect(app.db.docs.has(`families/${fid}/plans/${DATE}/members/${riya}`)).toBe(false);
    expect((await readStoredPlan(app.db, fid, DATE))?.plan).toMatchObject({ source: "template", generatingSince: null });
  });
});
