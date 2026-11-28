import { describe, expect, it } from "vitest";
import type { InFamily, SignedIn } from "@/server/app/guards";
import { loadKidCard } from "@/server/app/kidCardPage";
import { loadMember, loadToday } from "@/server/app/todayPage";
import { loadViewer, redirectFor, signInConfigured, type Viewer } from "@/server/app/viewer";
import { deps as airDeps } from "../../helpers/airDeps";
import { testApp, type TestApp } from "../../helpers/appDeps";
import { addRiya, joins, sharmaFamily, signUp } from "../../helpers/family";

const viewerOf = async (app: TestApp, uid: string) => (await loadViewer(`session:${uid}`, app.deps)) as SignedIn;
const inFamily = async (app: TestApp, uid: string) => (await viewerOf(app, uid)) as InFamily;

async function sharma() {
  const app = testApp();
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  await joins(app, "dadaji", "Ramesh", code, false);
  const riya = await addRiya(app, "rahul");
  return { app, fid, code, riya };
}

describe("viewer and redirects: pages verify the session", () => {
  it("knows signed out, not configured, removed and in-family viewers", async () => {
    const { app, fid } = await sharma();
    expect(await loadViewer(null, app.deps)).toEqual({ kind: "signed_out" });
    expect(await loadViewer("session:ghost", app.deps)).toEqual({ kind: "signed_out" });
    expect(await loadViewer("x", testApp({ db: null }).deps)).toEqual({ kind: "not_configured" });
    expect((await inFamily(app, "rahul")).bundle.id).toBe(fid);
    app.db.docs.set(`families/${fid}`, { ...app.db.docs.get(`families/${fid}`), memberUids: ["neha"] });
    expect((await viewerOf(app, "rahul")).bundle).toBeNull();
  });

  it("sends each viewer where the page needs", async () => {
    const { app } = await sharma();
    const out: Viewer = { kind: "signed_out" };
    const neha = await viewerOf(app, "neha");
    const dadaji = await viewerOf(app, "dadaji");
    await signUp(app, "solo", "Solo");
    const solo = await viewerOf(app, "solo");
    await signUp(app, "fresh", "Fresh", null);
    const fresh = await viewerOf(app, "fresh");
    expect(redirectFor(out, "account", "/today")).toBe("/sign-in?next=%2Ftoday");
    expect(redirectFor(solo, "family", "/today")).toBe("/onboarding");
    expect(redirectFor(neha, "family", "/today")).toBeNull();
    expect(redirectFor(neha, "no_family", "/family/new")).toBe("/today");
    expect(redirectFor(fresh, "no_family", "/family/new")).toBe("/onboarding");
    expect(redirectFor(solo, "no_family", "/family/new")).toBeNull();
    expect(redirectFor(out, "signed_out", "/sign-in")).toBeNull();
    expect(redirectFor(neha, "signed_out", "/sign-in")).toBe("/today");
    expect(redirectFor(dadaji, "signed_out", "/sign-in")).toBe("/onboarding");
    expect(signInConfigured(app.deps, {})).toBe(false);
    const web = {
      NEXT_PUBLIC_FIREBASE_API_KEY: "k",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "d",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p",
      NEXT_PUBLIC_FIREBASE_APP_ID: "a",
    };
    expect(signInConfigured(app.deps, web)).toBe(true);
    expect(signInConfigured({ db: null, sessions: null }, web)).toBe(false);
  });
});

describe("Today and the member plan", () => {
  it("plans everyone set up from code, shows Dadaji as setting up and the admin's join cards", async () => {
    const { app, riya } = await sharma();
    const today = await loadToday(await inFamily(app, "neha"), app.deps);
    expect(today.air.day?.rows.map((r) => r.person.id)).toEqual(["neha", "rahul", riya]);
    expect(today.air.setupVerdict).toBe("avoid");
    expect(today.family.people.find((p) => p.id === "dadaji")).toMatchObject({ onboarded: false, name: "Ramesh" });
    expect(today.joinCards.map((j) => j.name)).toEqual(["Rahul", "Ramesh"]);
    expect((await loadToday(await inFamily(app, "rahul"), app.deps)).joinCards).toEqual([]);
    expect(today.family.people.find((p) => p.id === riya)).toMatchObject({ guardianName: "Rahul", kind: "dependent", initials: "R" });
  });

  it("loads one person's plan, checklist and ticks; edit only for the guardian or admin", async () => {
    const { app, fid, riya } = await sharma();
    const item = (id: string, date: string, text: Record<string, string>, done: boolean) =>
      app.db.docs.set(`families/${fid}/items/${id}`, {
        forId: riya,
        date,
        time: null,
        kind: "checklist",
        text,
        addedBy: "rahul",
        addedByName: "Rahul",
        done,
      });
    item("a", "2024-11-18", { en: "Carry your water bottle" }, false);
    item("b", "2024-11-18", { hi: "15 मिनट N95 पहनो" }, true);
    item("c", "2024-11-17", { en: "Old" }, false);
    app.db.docs.set(`families/${fid}/progress/2024-11-18_${riya}`, {
      forId: riya,
      date: "2024-11-18",
      done: { "play-1": "x" },
      protectedHours: 0,
      co2AvoidedKg: 0,
    });
    const page = await loadMember(await inFamily(app, "rahul"), riya, app.deps);
    expect(page?.plan?.items).toHaveLength(3);
    expect(page?.checklist.map((c) => [c.text, c.onCard])).toEqual([
      ["Carry your water bottle", true],
      ["15 मिनट N95 पहनो", false],
    ]);
    expect(page?.ticked).toEqual(["play-1"]);
    expect(page?.canEdit).toBe(true);
    expect((await loadMember(await inFamily(app, "dadaji"), riya, app.deps))?.canEdit).toBe(false);
    expect(await loadMember(await inFamily(app, "neha"), "nobody", app.deps)).toBeNull();
  });

  it("builds the kid card in the card language with only the checked checklist items", async () => {
    const { app, fid, riya } = await sharma();
    app.db.docs.set(`families/${fid}/items/a`, {
      forId: riya,
      date: "2024-11-18",
      time: null,
      kind: "checklist",
      text: { en: "Wear an N95 for 15 minutes" },
      addedBy: "rahul",
      addedByName: "Rahul",
      done: false,
    });
    const page = await loadKidCard(await inFamily(app, "neha"), riya, app.deps);
    expect(page?.kid?.shareText).toMatch(/^Riya's air card for today /);
    expect(page?.kid?.shareText).not.toMatch(/AQI|µg|cigarette|\b\d{2,}\b/i);
    expect(page?.kid?.checklist).toEqual([]);
    expect(await loadKidCard(await inFamily(app, "neha"), "neha", app.deps)).toBeNull();
    const down = testApp({ db: app.db, air: airDeps({ fetchAir: async () => ({ ok: false as const, error: "timeout" as const }) }) });
    expect((await loadKidCard(await inFamily(app, "neha"), riya, down.deps))?.kid).toBeNull();
  });
});
