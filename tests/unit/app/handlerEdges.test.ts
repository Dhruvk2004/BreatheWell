import { describe, expect, it } from "vitest";
import { deleteAccount, deleteFamily } from "@/server/handlers/account";
import { regenerateCode } from "@/server/handlers/code";
import { addDependent, deleteDependent, updateDependent } from "@/server/handlers/dependent";
import { createFamily, updateFamily } from "@/server/handlers/family";
import { deleteItem, tickItem } from "@/server/handlers/items";
import { joinFamily } from "@/server/handlers/join";
import { leaveFamily, removeMember } from "@/server/handlers/members";
import { saveProfile } from "@/server/handlers/profile";
import { tickProgress } from "@/server/handlers/progress";
import type { AppDeps } from "@/server/deps";
import { json, request, testApp } from "../../helpers/appDeps";
import { HOME, HOME_SETUP, PROFILE, RIYA, sharmaFamily, signUp } from "../../helpers/family";
import { sharmaApp } from "../../helpers/dom";

/** Every write handler refuses a missing session and a foreign Origin before reading the body (spec 9.3, 11.2). */
type Handler = (request: Request, deps: AppDeps) => Promise<Response>;
const HANDLERS: readonly [string, string, Handler][] = [
  ["DELETE", "/api/account", deleteAccount],
  ["DELETE", "/api/family", deleteFamily],
  ["POST", "/api/family/code", regenerateCode],
  ["POST", "/api/dependent", addDependent],
  ["PUT", "/api/dependent/x", (r, d) => updateDependent(r, d, "x")],
  ["DELETE", "/api/dependent/x", (r, d) => deleteDependent(r, d, "x")],
  ["POST", "/api/family", createFamily],
  ["PATCH", "/api/family", updateFamily],
  ["PATCH", "/api/items/x", (r, d) => tickItem(r, d, "x")],
  ["DELETE", "/api/items/x", (r, d) => deleteItem(r, d, "x")],
  ["POST", "/api/join", joinFamily],
  ["POST", "/api/family/leave", leaveFamily],
  ["DELETE", "/api/family/members/x", (r, d) => removeMember(r, d, "x")],
  ["PUT", "/api/profile", saveProfile],
  ["POST", "/api/progress", tickProgress],
];

describe("write handlers: session, origin and body checks", () => {
  it.each(HANDLERS)("%s %s", async (method, path, handler) => {
    const app = testApp();
    await signUp(app, "neha", "Neha");
    expect((await handler(request(path, { method, body: {} }), app.deps)).status).toBe(401);
    expect((await handler(request(path, { method, uid: "neha", body: {}, origin: "https://evil.test" }), app.deps)).status).toBe(403);
  });

  it("refuses bodies that do not match, after the session check (review fix: authorise first)", async () => {
    const { app, riya } = await sharmaApp();
    const bad = { nonsense: true };
    for (const [method, path, handler] of [
      ["PUT", `/api/dependent/${riya}`, (r: Request, d: AppDeps) => updateDependent(r, d, riya)],
      ["POST", "/api/progress", tickProgress],
      ["PATCH", "/api/items/x", (r: Request, d: AppDeps) => tickItem(r, d, "x")],
      ["POST", "/api/dependent", addDependent],
      ["PATCH", "/api/family", updateFamily],
      ["PUT", "/api/profile", saveProfile],
    ] as const)
      expect((await handler(request(path, { method, uid: "neha", body: bad }), app.deps)).status).toBe(400);
    expect((await updateDependent(request(`/api/dependent/${riya}`, { method: "PUT", body: bad }), app.deps, riya)).status).toBe(401);
  });
});

describe("admin-only actions from a member or someone with no family (review fix)", () => {
  it("refuses a new code and settings changes from a member, and from a user without a family", async () => {
    const { app } = await sharmaApp();
    await signUp(app, "loner", "Loner");
    for (const uid of ["rahul", "loner"]) {
      expect((await regenerateCode(request("/api/family/code", { uid }), app.deps)).status).toBe(403);
      const patch = request("/api/family", { method: "PATCH", uid, body: { name: "Hijacked" } });
      expect((await updateFamily(patch, app.deps)).status).toBe(403);
      expect((await removeMember(request("/api/family/members/neha", { method: "DELETE", uid }), app.deps, "neha")).status).toBe(403);
    }
    expect((await leaveFamily(request("/api/family/leave", { uid: "loner" }), app.deps)).status).toBe(404);
    expect((await addDependent(request("/api/dependent", { uid: "loner", body: RIYA }), app.deps)).status).toBe(403);
  });

  it("changes only the name, or only the home set-up", async () => {
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    await updateFamily(request("/api/family", { method: "PATCH", uid: "neha", body: { name: "Sharma ghar" } }), app.deps);
    expect(app.db.docs.get(`families/${fid}`)).toMatchObject({ name: "Sharma ghar", home: { placeName: HOME.name } });
    const setup = { ...HOME_SETUP, purifier: "several" };
    await updateFamily(request("/api/family", { method: "PATCH", uid: "neha", body: { homeSetup: setup } }), app.deps);
    expect(app.db.docs.get(`families/${fid}`)?.name).toBe("Sharma ghar");
    expect(app.db.docs.get(`families/${fid}/private/home`)).toMatchObject({ purifier: "several" });
  });
});

describe("join codes", () => {
  it("draws again when a new code clashes with one in use (seeded random source)", async () => {
    const same = () => Uint8Array.from({ length: 16 }, (_, i) => i * 7);
    let calls = 0;
    const app = testApp({ randomBytes: (size) => (calls++ < 2 ? same() : Uint8Array.from({ length: size }, (_, i) => 200 - i)) });
    const first = await sharmaFamily(app);
    await signUp(app, "amit", "Amit");
    const body = { name: "Kulkarni family", home: HOME, homeSetup: HOME_SETUP };
    const second = await json<{ code: string }>(await createFamily(request("/api/family", { uid: "amit", body }), app.deps));
    expect(second.code).not.toBe(first.code);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("treats a familyId whose family is gone as no family, so the joiner can join (stage 7 AUTH-2)", async () => {
    const { app, code } = await sharmaApp();
    await signUp(app, "amit", "Amit");
    app.db.docs.set("users/amit", { ...app.db.docs.get("users/amit"), familyId: "vanished" });
    expect(await json(await joinFamily(request("/api/join", { uid: "amit", body: { code } }), app.deps))).toEqual({
      kind: "joined",
      familyName: "Sharma family",
    });
  });
});

describe("progress", () => {
  it("refuses someone outside the family and an unknown person", async () => {
    const { app } = await sharmaApp();
    await signUp(app, "loner", "Loner", { ...PROFILE, name: "Loner" });
    const tick = (uid: string, forId: string) =>
      tickProgress(request("/api/progress", { uid, body: { forId, key: "office_trip", done: true } }), app.deps);
    expect((await tick("loner", "loner")).status).toBe(403);
    expect((await tick("neha", "nobody")).status).toBe(404);
  });
});
