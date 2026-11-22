import { describe, expect, it } from "vitest";
import { addDependent, deleteDependent, updateDependent } from "@/server/handlers/dependent";
import { json, request, testApp } from "../../helpers/appDeps";
import { addRiya, joins, RIYA, sharmaFamily, signUp } from "../../helpers/family";

describe("POST /api/dependent (spec 5.5, 6.2, 9.3)", () => {
  it("adds a child with the defaults filled in, the caller as guardian, and marks the plan stale", async () => {
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    const id = await addRiya(app);
    expect(id).not.toContain("Riya");
    expect(app.db.docs.get(`families/${fid}/dependents/${id}`)).toMatchObject({
      name: "Riya",
      ageGroup: "under13",
      careTag: "extra",
      guardianUid: "neha",
      cardLanguage: "en",
      activities: [
        { id: "school_trip-1", type: "school_trip", usual: "07:00", flex: "fixed", duration: "15to60" },
        { id: "school_trip-2", usual: "13:00" },
        { id: "play-1", type: "play", usual: "17:00", flex: "any" },
      ],
      travel: { main: "cycle", tripLength: "15to45", others: ["school_bus", "car"] },
    });
    expect(app.db.docs.get(`families/${fid}/plans/2024-11-18`)).toEqual({ stale: true, expireAt: "2024-12-18T00:00:00.000Z" });
  });

  it("refuses a fifth child, a caller without a family and bad input", async () => {
    const app = testApp();
    await sharmaFamily(app);
    for (let i = 0; i < 4; i++) await addRiya(app);
    const fifth = await addDependent(request("/api/dependent", { uid: "neha", body: RIYA }), app.deps);
    expect(fifth.status).toBe(409);
    expect((await json<{ error: { message: string } }>(fifth)).error.message).toBe("A family can add up to 4 children or teens in v1.");
    await signUp(app, "solo", "Solo");
    expect((await addDependent(request("/api/dependent", { uid: "solo", body: RIYA }), app.deps)).status).toBe(403);
    expect((await addDependent(request("/api/dependent", { uid: "neha", body: { ...RIYA, name: "x".repeat(21) } }), app.deps)).status).toBe(
      400,
    );
    expect(
      (
        await addDependent(
          request("/api/dependent", { uid: "neha", body: { ...RIYA, picks: [{ choice: "play" }, { choice: "play" }] } }),
          app.deps,
        )
      ).status,
    ).toBe(400);
  });
});

describe("PUT and DELETE /api/dependent/{id} (guardian or admin)", () => {
  it("lets the guardian and the admin edit; others get 403; unknown ids 404", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    await joins(app, "dadaji", "Dadaji", code);
    const id = await addRiya(app, "rahul");
    const edit = (uid: string, did = id) =>
      updateDependent(
        request(`/api/dependent/${did}`, { method: "PUT", uid, body: { ...RIYA, name: "Gudiya", cardLanguage: "hi" } }),
        app.deps,
        did,
      );
    expect((await edit("dadaji")).status).toBe(403);
    expect((await edit("rahul")).status).toBe(200);
    expect((await edit("neha")).status).toBe(200);
    expect(app.db.docs.get(`families/${fid}/dependents/${id}`)).toMatchObject({ name: "Gudiya", cardLanguage: "hi", guardianUid: "rahul" });
    expect((await edit("neha", "missing")).status).toBe(404);
    const bad = await updateDependent(request(`/api/dependent/${id}`, { method: "PUT", uid: "neha", body: {} }), app.deps, id);
    expect(bad.status).toBe(400);
  });

  it("erases the dependent's items, ticks and plan sections at once", async () => {
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    const id = await addRiya(app);
    const other = await addRiya(app);
    app.db.docs.set(`families/${fid}/items/i1`, { forId: id, date: "2024-11-18" });
    app.db.docs.set(`families/${fid}/items/i2`, { forId: other, date: "2024-11-18" });
    app.db.docs.set(`families/${fid}/progress/2024-11-18_${id}`, { forId: id });
    app.db.docs.set(`families/${fid}/plans/2024-11-18/members/${id}`, { items: [] });
    const response = await deleteDependent(request(`/api/dependent/${id}`, { method: "DELETE", uid: "neha" }), app.deps, id);
    expect(response.status).toBe(200);
    for (const path of [`dependents/${id}`, "items/i1", `progress/2024-11-18_${id}`, `plans/2024-11-18/members/${id}`])
      expect(app.db.docs.has(`families/${fid}/${path}`)).toBe(false);
    expect(app.db.docs.has(`families/${fid}/items/i2`)).toBe(true);
    expect(app.db.docs.has(`families/${fid}/dependents/${other}`)).toBe(true);
  });
});
