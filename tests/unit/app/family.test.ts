import { describe, expect, it } from "vitest";
import { regenerateCode } from "@/server/handlers/code";
import { createFamily, updateFamily } from "@/server/handlers/family";
import { json, request, testApp } from "../../helpers/appDeps";
import { HOME, HOME_SETUP, joins, sharmaFamily, signUp } from "../../helpers/family";

const body = { name: "Sharma family", home: HOME, homeSetup: HOME_SETUP };

describe("POST /api/family", () => {
  it("makes the creator the admin and first member, stores the rounded home and the first code", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    expect(app.db.docs.get(`families/${fid}`)).toMatchObject({
      name: "Sharma family",
      adminUid: "neha",
      memberUids: ["neha"],
      home: { placeName: "Green Park, New Delhi", lat2: 28.56, lon2: 77.21, gridId: "28.6_77.2", countryCode: "IN" },
    });
    expect(app.db.docs.get(`families/${fid}/private/home`)).toEqual(HOME_SETUP);
    expect(app.db.docs.get(`families/${fid}/members/neha`)).toMatchObject({
      name: "Neha",
      onboarded: true,
      careTag: "none",
      joinedVia: null,
    });
    expect(app.db.docs.get("users/neha")).toMatchObject({ familyId: fid, role: "admin" });
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(app.db.docs.get(`joinCodes/${code}`)).toMatchObject({
      familyId: fid,
      uses: 0,
      maxUses: 8,
      active: true,
      expiresAt: "2024-11-19T00:40:00.000Z",
      expireAt: "2024-11-20T00:40:00.000Z",
    });
  });

  it("refuses a second family, a missing profile and bad input", async () => {
    const app = testApp();
    await sharmaFamily(app);
    const again = await createFamily(request("/api/family", { uid: "neha", body }), app.deps);
    expect(again.status).toBe(409);
    expect((await createFamily(request("/api/family", { uid: "ghost", body }), app.deps)).status).toBe(404);
    const spoof = { ...body, home: { ...HOME, name: "Win a prize at evil.example" } };
    expect((await createFamily(request("/api/family", { uid: "neha", body: spoof }), app.deps)).status).toBe(400);
    const far = { ...body, home: { ...HOME, lat: 120 } };
    expect((await createFamily(request("/api/family", { uid: "neha", body: far }), app.deps)).status).toBe(400);
    expect((await createFamily(request("/api/family", { uid: "neha", body: { ...body, name: "" } }), app.deps)).status).toBe(400);
  });
});

describe("PATCH /api/family", () => {
  it("lets the admin change the name, home and set-up and marks the plan stale", async () => {
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    const patch = {
      name: "Sharmas",
      home: { ...HOME, name: "Kothrud, Pune", lat: 18.5074, lon: 73.8077 },
      homeSetup: { ...HOME_SETUP, purifier: "several" },
    };
    expect((await updateFamily(request("/api/family", { method: "PATCH", uid: "neha", body: patch }), app.deps)).status).toBe(200);
    expect(app.db.docs.get(`families/${fid}`)).toMatchObject({ name: "Sharmas", home: { lat2: 18.51, lon2: 73.81, gridId: "18.5_73.8" } });
    expect(app.db.docs.get(`families/${fid}/private/home`)?.purifier).toBe("several");
    expect(app.db.docs.get(`families/${fid}/plans/2024-11-18`)).toEqual({ stale: true, expireAt: "2024-12-18T00:00:00.000Z" });
    expect(
      (await updateFamily(request("/api/family", { method: "PATCH", uid: "neha", body: { name: "Only name" } }), app.deps)).status,
    ).toBe(200);
  });

  it("is admin only and needs at least one change", async () => {
    const app = testApp();
    const { code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    expect((await updateFamily(request("/api/family", { method: "PATCH", uid: "rahul", body: { name: "Mine" } }), app.deps)).status).toBe(
      403,
    );
    expect((await updateFamily(request("/api/family", { method: "PATCH", uid: "neha", body: {} }), app.deps)).status).toBe(400);
    await signUp(app, "solo", "Solo");
    expect((await updateFamily(request("/api/family", { method: "PATCH", uid: "solo", body: { name: "Mine" } }), app.deps)).status).toBe(
      403,
    );
  });
});

describe("POST /api/family/code", () => {
  it("replaces the old code at once, admin only", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    const response = await regenerateCode(request("/api/family/code", { uid: "neha" }), app.deps);
    expect(response.status).toBe(201);
    const fresh = (await json<{ code: string }>(response)).code;
    expect(fresh).not.toBe(code);
    expect(app.db.docs.has(`joinCodes/${code}`)).toBe(false);
    expect(app.db.docs.get(`joinCodes/${fresh}`)?.familyId).toBe(fid);
    await joins(app, "rahul", "Rahul", fresh);
    expect((await regenerateCode(request("/api/family/code", { uid: "rahul" }), app.deps)).status).toBe(403);
  });
});
