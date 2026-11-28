import { describe, expect, it } from "vitest";
import { liveCode, loadInvite, loadInvitePreview, loadJoinPage } from "@/server/app/invitePages";
import { loadViewer } from "@/server/app/viewer";
import { collectPeopleData } from "@/server/repos/cleanup";
import { callerFamily, familyFor, loadFamily, markPlanStale, retainedUntil } from "@/server/repos/family";
import { checklistFor } from "@/server/repos/items";
import { familyRecord, parsed } from "@/server/repos/records";
import { NOW } from "../../helpers/airDeps";
import { sharmaApp } from "../../helpers/dom";
import { signUp } from "../../helpers/family";

/** The repositories' less common paths: gone or malformed documents, other languages, retention. */
const item = (forId: string, text: Record<string, string>, date = "2024-11-18") => ({
  forId,
  date,
  time: null,
  kind: "checklist",
  text,
  addedBy: "neha",
  addedByName: "Neha",
  done: false,
});

describe("family repository", () => {
  it("skips malformed members and dependents, and returns null for a family that is gone", async () => {
    const { app, fid } = await sharmaApp();
    app.db.docs.set(`families/${fid}/dependents/broken`, { name: 3 });
    app.db.docs.set(`families/${fid}/members/rahul`, { ...app.db.docs.get(`families/${fid}/members/rahul`), activities: "x" });
    const bundle = await loadFamily(app.db, fid);
    expect(bundle?.dependents.map((d) => d.id)).not.toContain("broken");
    expect(bundle?.members.map((m) => m.uid)).not.toContain("rahul");
    expect(await loadFamily(app.db, "gone")).toBeNull();
    expect(parsed(familyRecord, { name: "x" })).toBeNull();
  });

  it("finds the caller's family only for a member", async () => {
    const { app, fid } = await sharmaApp();
    await app.db.transaction(async (tx) => {
      expect(await familyFor(tx, fid, "stranger")).toBeNull();
      expect(await callerFamily(tx, "stranger")).toBeNull();
      expect(await callerFamily(tx, "rahul")).toMatchObject({ fid, user: { name: "Rahul" } });
    });
  });

  it("flags a stale plan with its 30-day expiry", async () => {
    const { app, fid } = await sharmaApp();
    await app.db.transaction(async (tx) => markPlanStale(tx, fid, NOW));
    expect(app.db.docs.get(`families/${fid}/plans/2024-11-18`)).toEqual({ stale: true, expireAt: "2024-12-18T00:00:00.000Z" });
    expect(retainedUntil("2024-12-25")).toBe("2025-01-24T00:00:00.000Z");
  });

  it("collects only the plan sections that exist, so nothing is deleted blindly", async () => {
    const { app, fid, riya } = await sharmaApp();
    app.db.docs.set(`families/${fid}/plans/2024-11-17`, { stale: true });
    app.db.docs.set(`families/${fid}/plans/2024-11-17/members/${riya}`, { items: [] });
    app.db.docs.set(`families/${fid}/plans/2024-11-17/members/neha`, { items: [] });
    const data = await app.db.transaction((tx) => collectPeopleData(tx, fid, [riya]));
    expect(data.planSections).toEqual([`families/${fid}/plans/2024-11-17/members/${riya}`]);
  });
});

describe("checklist and invite codes", () => {
  it("reads today's items only, in the viewer's language or the other one, skipping empty and broken ones", async () => {
    const { app, fid, riya } = await sharmaApp();
    app.db.docs.set(`families/${fid}/items/a`, item(riya, { hi: "पानी की बोतल लें" }));
    app.db.docs.set(`families/${fid}/items/b`, item(riya, {}));
    app.db.docs.set(`families/${fid}/items/c`, item(riya, { en: "Yesterday" }, "2024-11-17"));
    app.db.docs.set(`families/${fid}/items/d`, { forId: riya, date: "2024-11-18" });
    const list = await checklistFor(app.db, fid, riya, "2024-11-18", "en");
    expect(list.map((i) => i.text)).toEqual(["पानी की बोतल लें"]);
  });

  it("has no live code once every code has expired", async () => {
    const { app, viewer, code } = await sharmaApp();
    app.db.docs.set(`joinCodes/${code}`, { ...app.db.docs.get(`joinCodes/${code}`), expiresAt: "2024-01-01T00:00:00.000Z" });
    expect(await liveCode(await viewer("neha"), app.deps)).toBeNull();
  });
});

describe("invite page loaders: the rarer answers", () => {
  const headers = new Headers({ "x-forwarded-for": "198.51.100.77" });

  it("an admin without a live code gets Make a new code; an expired code with no admin profile names nobody", async () => {
    const { app, viewer, code } = await sharmaApp();
    app.db.docs.set(`joinCodes/${code}`, { ...app.db.docs.get(`joinCodes/${code}`), expiresAt: "2024-01-01T00:00:00.000Z" });
    expect(await loadInvite(await viewer("neha"), app.deps, "https://app.test")).toMatchObject({
      code: null,
      joinUrl: null,
      expiresAt: null,
    });
    app.db.docs.delete("users/neha");
    expect(await loadInvitePreview(code, headers, app.deps)).toEqual({ kind: "expired", adminName: "" });
  });

  it("the join page knows a signed-in viewer without a family, and has no expiry for a bad code", async () => {
    const { app, code } = await sharmaApp();
    await signUp(app, "amit", "Amit", null);
    const amit = await loadViewer("session:amit", app.deps);
    const page = await loadJoinPage(code, headers, amit, app.deps);
    expect(page.viewer).toEqual({ signedIn: true, onboarded: false, familyName: null });
    expect(page.expiresAt).toEqual(expect.any(String));
    expect((await loadJoinPage("ZZZZZZZZ", headers, amit, app.deps)).expiresAt).toBeNull();
  });
});
