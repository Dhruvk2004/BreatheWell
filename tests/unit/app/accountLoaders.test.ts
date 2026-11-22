import { describe, expect, it } from "vitest";
import { loadOnboarding, loadProfile, loadSettingsPage } from "@/server/app/accountPages";
import { loadDependent } from "@/server/app/dependentPage";
import type { InFamily, SignedIn } from "@/server/app/guards";
import { joinUrl, loadInvite, loadInvitePreview, loadJoinPage } from "@/server/app/invitePages";
import { loadViewer } from "@/server/app/viewer";
import { regenerateCode } from "@/server/handlers/code";
import { request, testApp, type TestApp } from "../../helpers/appDeps";
import { RIYA, signUp } from "../../helpers/family";
import { sharmaApp } from "../../helpers/dom";

/** Invite and account page loaders (spec 10.5, 10.7, 10.12, 10.14, 10.15). */
const viewerOf = async (app: TestApp, uid: string) => (await loadViewer(`session:${uid}`, app.deps)) as SignedIn;
const inFamily = async (app: TestApp, uid: string) => (await viewerOf(app, uid)) as InFamily;
const headers = new Headers({ "x-forwarded-for": "198.51.100.20" });
const sharma = sharmaApp;

describe("invite pages (spec 10.7, 5.4)", () => {
  it("shows the admin's live code and nothing to others", async () => {
    const { app, code } = await sharma();
    expect(await loadInvite(await inFamily(app, "neha"), app.deps, "https://app.test")).toMatchObject({
      familyName: "Sharma family",
      code,
      joinUrl: `https://app.test/join/${code}`,
    });
    expect(await loadInvite(await inFamily(app, "rahul"), app.deps, "https://app.test")).toBeNull();
    expect(joinUrl("http://localhost:3000", "K7PM4QXT")).toBe("http://localhost:3000/join/K7PM4QXT");
  });

  it("previews a checked code only; expired names the admin; limited per IP", async () => {
    const { app, code } = await sharma();
    expect(await loadInvitePreview(code, headers, app.deps)).toMatchObject({
      kind: "valid",
      familyName: "Sharma family",
      adminName: "Neha",
    });
    expect(await loadInvitePreview("nonsense", headers, app.deps)).toEqual({ kind: "not_found" });
    await regenerateCode(request("/api/family/code", { uid: "neha" }), app.deps);
    expect(await loadInvitePreview(code, headers, app.deps)).toEqual({ kind: "not_found" });
    expect(await loadInvitePreview(code, headers, testApp({ db: null }).deps)).toEqual({ kind: "not_configured" });
    const page = await loadJoinPage("ZZZZZZZZ", headers, await viewerOf(app, "rahul"), app.deps);
    expect(page.viewer).toEqual({ signedIn: true, onboarded: true, familyName: "Sharma family" });
    expect((await loadJoinPage("ZZZZZZZZ", headers, { kind: "signed_out" }, app.deps)).viewer.signedIn).toBe(false);
    for (let i = 0; i < 30; i++) await loadInvitePreview(code, new Headers({ "x-forwarded-for": "198.51.100.99" }), app.deps);
    expect(await loadInvitePreview(code, new Headers({ "x-forwarded-for": "198.51.100.99" }), app.deps)).toEqual({ kind: "rate_limited" });
  });
});

describe("account pages (spec 10.5, 10.14, 10.15, 10.12)", () => {
  it("prefills onboarding and the profile from the saved answers", async () => {
    const { app, riya } = await sharma();
    expect(await loadOnboarding(await viewerOf(app, "dadaji"), app.deps)).toMatchObject({
      googleName: "Ramesh",
      input: null,
      hasFamily: true,
    });
    const profile = await loadProfile(await viewerOf(app, "rahul"), app.deps);
    expect(profile).toMatchObject({
      familyName: "Sharma family",
      isAdmin: false,
      mustStay: false,
      dependents: [{ id: riya, name: "Riya" }],
    });
    expect(profile?.input.activities).toEqual([{ type: "office_trip", band: "morning", flex: "fixed", duration: "15to60" }]);
    expect((await loadProfile(await viewerOf(app, "neha"), app.deps))?.mustStay).toBe(true);
    expect(await loadProfile(await viewerOf(app, "dadaji"), app.deps)).toBeNull();
    await signUp(app, "solo", "Solo");
    expect(await loadProfile(await viewerOf(app, "solo"), app.deps)).toMatchObject({ familyName: null, mustStay: false });
  });

  it("formats join times for settings and loads the dependent form for the guardian or admin", async () => {
    const { app, riya } = await sharma();
    const { joinedAt, code } = await loadSettingsPage(await inFamily(app, "neha"), app.deps, "en");
    expect(joinedAt.rahul).toBe("Mon, 18 Nov, 6:10 am");
    expect(code).toMatch(/^\w{8}$/);
    expect(loadDependent(await inFamily(app, "neha"), null)).toMatchObject({ guardianName: "Neha", id: null, input: null });
    const edit = loadDependent(await inFamily(app, "neha"), riya);
    expect(edit?.input).toMatchObject({
      name: "Riya",
      picks: [
        { choice: "school_trip", times: ["07:00", "13:00"] },
        { choice: "play", times: ["17:00"] },
      ],
      travel: { main: RIYA.travel.main },
    });
    expect(loadDependent(await inFamily(app, "dadaji"), riya)).toBeNull();
    expect(loadDependent(await inFamily(app, "neha"), "nope")).toBeNull();
  });
});
