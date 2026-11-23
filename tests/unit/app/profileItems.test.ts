import { describe, expect, it } from "vitest";
import { deleteItem, tickItem } from "@/server/handlers/items";
import { saveProfile } from "@/server/handlers/profile";
import { tickProgress } from "@/server/handlers/progress";
import { json, request, testApp } from "../../helpers/appDeps";
import { addRiya, joins, PROFILE, sharmaFamily, signUp } from "../../helpers/family";

describe("PUT /api/profile (spec 6.1, 6.5, 10.5)", () => {
  it("keeps condition names in the private health doc; the family sees only the tag", async () => {
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    const body = {
      ...PROFILE,
      name: "Dadaji",
      language: "hi",
      ageGroup: "60plus",
      conditions: ["asthma"],
      shareWith: "admin",
    };
    const response = await saveProfile(request("/api/profile", { method: "PUT", uid: "neha", body }), app.deps);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(";")).toMatch(/bw-acct=D;.*bw-lang=hi/);
    expect(app.db.docs.get("users/neha/private/health")).toMatchObject({ conditions: ["asthma"], shareWith: "admin" });
    const member = app.db.docs.get(`families/${fid}/members/neha`);
    expect(member).toMatchObject({
      name: "Dadaji",
      language: "hi",
      careTag: "extra",
      onboarded: true,
      activities: [{ id: "office_trip", usual: "08:00" }],
    });
    expect(JSON.stringify(member)).not.toContain("asthma");
    expect(app.db.docs.get("users/neha")?.profile).toMatchObject({ ageGroup: "60plus", careTag: "extra", travel: { others: ["metro"] } });
  });

  it("refuses a pregnant 60+, more than 4 activities, a repeated one and a missing profile", async () => {
    const app = testApp();
    await signUp(app, "u", "U");
    const put = (body: unknown, uid = "u") => saveProfile(request("/api/profile", { method: "PUT", uid, body }), app.deps);
    expect((await put({ ...PROFILE, ageGroup: "60plus", conditions: ["pregnant"] })).status).toBe(400);
    const act = PROFILE.activities[0];
    expect((await put({ ...PROFILE, activities: [act, act] })).status).toBe(400);
    expect(
      (
        await put({
          ...PROFILE,
          activities: ["morning_walk", "office_trip", "sport", "errands", "tuition"].map((type) => ({ ...act, type })),
        })
      ).status,
    ).toBe(400);
    expect((await put({ ...PROFILE, name: "https://x.io" })).status).toBe(400);
    expect((await put(PROFILE, "ghost")).status).toBe(404);
  });
});

describe("PATCH and DELETE /api/items/{id} (spec 9.2–9.3)", () => {
  async function withItems() {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    const riya = await addRiya(app, "neha");
    const item = (forId: string, addedBy: string) => ({
      forId,
      date: "2024-11-18",
      time: null,
      kind: "checklist",
      text: { en: "Carry water" },
      addedBy,
      addedByName: "X",
      done: false,
    });
    app.db.docs.set(`families/${fid}/items/mine`, item("rahul", "neha"));
    app.db.docs.set(`families/${fid}/items/kid`, item(riya, "rahul"));
    app.db.docs.set(`families/${fid}/items/hers`, item("neha", "neha"));
    return { app, fid };
  }
  const tick = (app: ReturnType<typeof testApp>, uid: string, id: string) =>
    tickItem(request(`/api/items/${id}`, { method: "PATCH", uid, body: { done: true } }), app.deps, id);
  const del = (app: ReturnType<typeof testApp>, uid: string, id: string) =>
    deleteItem(request(`/api/items/${id}`, { method: "DELETE", uid }), app.deps, id);

  it("ticks: own items, and any member for a dependent", async () => {
    const { app, fid } = await withItems();
    expect((await tick(app, "rahul", "mine")).status).toBe(200);
    expect(app.db.docs.get(`families/${fid}/items/mine`)).toMatchObject({ done: true, doneAt: "2024-11-18T00:40:00.000Z" });
    expect((await tick(app, "rahul", "kid")).status).toBe(200);
    expect((await tick(app, "rahul", "hers")).status).toBe(403);
    expect((await tick(app, "rahul", "none")).status).toBe(404);
    await tickItem(request("/api/items/mine", { method: "PATCH", uid: "rahul", body: { done: false } }), app.deps, "mine");
    expect(app.db.docs.get(`families/${fid}/items/mine`)?.doneAt).toBeNull();
    expect(
      (await tickItem(request("/api/items/mine", { method: "PATCH", uid: "rahul", body: { done: 1 } }), app.deps, "mine")).status,
    ).toBe(400);
  });

  it("deletes: the target, the adder, the guardian or the admin", async () => {
    const { app } = await withItems();
    expect((await del(app, "rahul", "hers")).status).toBe(403);
    expect((await del(app, "rahul", "kid")).status).toBe(200);
    expect((await del(app, "neha", "mine")).status).toBe(200);
    await signUp(app, "stranger", "S");
    expect((await del(app, "stranger", "hers")).status).toBe(404);
  });
});

describe("POST /api/progress (spec 5.7, 9.1)", () => {
  const tick = (app: ReturnType<typeof testApp>, uid: string, forId: string, key: string, done = true) =>
    tickProgress(request("/api/progress", { uid, body: { forId, key, done } }), app.deps);

  it("ticks one of today's plan keys, recomputes the totals and keeps it 30 days", async () => {
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    const response = await tick(app, "neha", "neha", "office_trip");
    expect(response.status).toBe(200);
    const saved = await json<{ done: string[]; protectedHours: number; co2AvoidedKg: number }>(response);
    expect(saved.done).toEqual(["office_trip"]);
    expect(app.db.docs.get(`families/${fid}/progress/2024-11-18_neha`)).toMatchObject({
      forId: "neha",
      date: "2024-11-18",
      expireAt: "2024-12-18T00:00:00.000Z",
    });
    expect((await json<{ done: string[] }>(await tick(app, "neha", "neha", "office_trip", false))).done).toEqual([]);
  });

  it("lets any member tick a dependent, not another adult; refuses unknown keys and strangers", async () => {
    const app = testApp();
    const { code } = await sharmaFamily(app);
    await joins(app, "rahul", "Rahul", code);
    const riya = await addRiya(app);
    expect((await tick(app, "rahul", riya, "play-1")).status).toBe(200);
    expect((await tick(app, "rahul", "neha", "office_trip")).status).toBe(403);
    expect((await tick(app, "rahul", "rahul", "walk")).status).toBe(400);
    expect((await tick(app, "rahul", "ghost", "x")).status).toBe(404);
    await signUp(app, "stranger", "S");
    expect((await tick(app, "stranger", riya, "play-1")).status).toBe(403);
  });
});
