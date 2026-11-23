import { describe, expect, it } from "vitest";
import { deleteAccount, deleteFamily } from "@/server/handlers/account";
import { regenerateCode } from "@/server/handlers/code";
import { leaveFamily, removeMember } from "@/server/handlers/members";
import { joinMessage } from "@/components/family/joinMessages";
import { json, request, testApp } from "../../helpers/appDeps";
import { addRiya, joins, sharmaFamily, signUp } from "../../helpers/family";

const leave = (app: ReturnType<typeof testApp>, uid: string) => leaveFamily(request("/api/family/leave", { uid }), app.deps);
const remove = (app: ReturnType<typeof testApp>, uid: string, target: string) =>
  removeMember(request(`/api/family/members/${target}`, { method: "DELETE", uid }), app.deps, target);

describe("leave and remove (spec 5.9, 5.10)", () => {
  it("a member leaves with the children they added; the profile stays", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    const aarav = await addRiya(app, "rahul");
    const riya = await addRiya(app, "neha");
    app.db.docs.set(`families/${fid}/items/i1`, { forId: "rahul", date: "2024-11-18" });
    expect((await leave(app, "rahul")).status).toBe(200);
    expect(app.db.docs.get(`families/${fid}`)?.memberUids).toEqual(["neha"]);
    for (const path of ["members/rahul", `dependents/${aarav}`, "items/i1"]) expect(app.db.docs.has(`families/${fid}/${path}`)).toBe(false);
    expect(app.db.docs.has(`families/${fid}/dependents/${riya}`)).toBe(true);
    expect(app.db.docs.get("users/rahul")).toMatchObject({
      familyId: null,
      role: null,
      removedFrom: null,
      profile: { ageGroup: "18to59" },
    });
    expect((await leave(app, "rahul")).status).toBe(404);
  });

  it("the admin cannot leave: remove others first, or delete the family when alone", async () => {
    const app = testApp();
    const { code } = await sharmaFamily(app);
    expect((await json<{ error: { code: string } }>(await leave(app, "neha"))).error.code).toBe("admin_alone");
    await joins(app, "rahul", "Rahul", code);
    expect((await json<{ error: { code: string } }>(await leave(app, "neha"))).error.code).toBe("admin_with_members");
  });

  it("the admin removes a member, who is told once by family name", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    await joins(app, "dadaji", "Dadaji", code);
    expect((await remove(app, "rahul", "dadaji")).status).toBe(403);
    expect((await remove(app, "neha", "neha")).status).toBe(400);
    expect((await remove(app, "neha", "ghost")).status).toBe(404);
    expect((await remove(app, "neha", "rahul")).status).toBe(200);
    expect(app.db.docs.get(`families/${fid}`)?.memberUids).toEqual(["neha", "dadaji"]);
    expect(app.db.docs.get("users/rahul")).toMatchObject({ familyId: null, removedFrom: "Sharma family" });
  });

  it("a removed member cannot rejoin with a code made before the removal, only with a new one (QA8-2)", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    expect((await remove(app, "neha", "rahul")).status).toBe(200);
    expect(app.db.docs.get(`joinCodes/${code}`)?.removedUids).toEqual(["rahul"]);
    const again = await joins(app, "rahul", "Rahul", code);
    expect(again.status).toBe(403);
    const body = await json<{ kind: string; adminName: string }>(again);
    expect(body).toEqual({ kind: "removed", adminName: "Neha" });
    expect(joinMessage({ code: body.kind, adminName: body.adminName }, "en")).toContain("Ask Neha for a new one");
    expect(joinMessage({ code: "removed" }, "hi")).toContain("नया कोड");
    expect(app.db.docs.get(`families/${fid}`)?.memberUids).toEqual(["neha"]);
    // Someone else can still use the old code.
    expect((await joins(app, "dadaji", "Dadaji", code)).status).toBe(200);
    const fresh = await json<{ code: string }>(await regenerateCode(request("/api/family/code", { uid: "neha" }), app.deps));
    expect((await joins(app, "rahul", "Rahul", fresh.code)).status).toBe(200);
  });
});

describe("DELETE /api/account (spec 5.10, 10.15)", () => {
  it("erases a member's profile, health, member doc and children, and the Auth user", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    const aarav = await addRiya(app, "rahul");
    const response = await deleteAccount(request("/api/account", { method: "DELETE", uid: "rahul" }), app.deps);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toHaveLength(2);
    for (const path of [
      "users/rahul",
      "users/rahul/private/health",
      `families/${fid}/members/rahul`,
      `families/${fid}/dependents/${aarav}`,
    ])
      expect(app.db.docs.has(path)).toBe(false);
    expect(app.auth.deleted).toEqual(["rahul"]);
  });

  it("blocks an admin with members; an admin alone takes the family and its codes", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    expect((await deleteAccount(request("/api/account", { method: "DELETE", uid: "neha" }), app.deps)).status).toBe(409);
    await remove(app, "neha", "rahul");
    await addRiya(app);
    expect((await deleteAccount(request("/api/account", { method: "DELETE", uid: "neha" }), app.deps)).status).toBe(200);
    expect(
      [...app.db.docs.keys()].filter((k) => k.startsWith(`families/${fid}`) || k.startsWith("joinCodes/") || k === "users/neha"),
    ).toEqual([]);
  });

  it("deletes an account without a family", async () => {
    const app = testApp();
    await signUp(app, "solo", "Solo");
    expect((await deleteAccount(request("/api/account", { method: "DELETE", uid: "solo" }), app.deps)).status).toBe(200);
    expect(app.db.docs.has("users/solo")).toBe(false);
  });
});

describe("DELETE /api/family (spec 10.14 Danger zone)", () => {
  const del = (app: ReturnType<typeof testApp>, uid: string, confirmName: string) =>
    deleteFamily(request("/api/family", { method: "DELETE", uid, body: { confirmName } }), app.deps);

  it("needs the admin, alone, and the typed family name", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    expect((await del(app, "rahul", "Sharma family")).status).toBe(403);
    expect((await del(app, "neha", "Sharma family")).status).toBe(409);
    await remove(app, "neha", "rahul");
    expect((await del(app, "neha", "Verma family")).status).toBe(400);
    expect((await del(app, "neha", " sharma FAMILY ")).status).toBe(200);
    expect(app.db.docs.has(`families/${fid}`)).toBe(false);
    expect(app.db.docs.get("users/neha")).toMatchObject({ familyId: null, role: null });
    expect((await deleteFamily(request("/api/family", { method: "DELETE", uid: "neha", body: {} }), app.deps)).status).toBe(400);
  });
});
