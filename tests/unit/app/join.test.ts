import { describe, expect, it } from "vitest";
import { countAttempt, JOIN_DAY_MAX } from "@/server/repos/joinAttempts";
import { joinFamily, JOIN_MIN_MS } from "@/server/handlers/join";
import { json, request, testApp } from "../../helpers/appDeps";
import { createFamily } from "@/server/handlers/family";
import { HOME, HOME_SETUP, joins, sharmaFamily, signUp } from "../../helpers/family";
import { NOW } from "../../helpers/airDeps";

const join = (app: ReturnType<typeof testApp>, uid: string, code: string) =>
  joinFamily(request("/api/join", { uid, body: { code } }), app.deps);

describe("POST /api/join", () => {
  it("adds the member with the join logged, uses the code once and marks the plan stale", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    const response = await joins(app, "rahul", "Rahul", `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ kind: "joined", familyName: "Sharma family" });
    expect(app.db.docs.get(`families/${fid}`)?.memberUids).toEqual(["neha", "rahul"]);
    expect(app.db.docs.get(`families/${fid}/members/rahul`)).toMatchObject({
      name: "Rahul",
      onboarded: true,
      joinedVia: { code, at: NOW.toISOString() },
    });
    expect(app.db.docs.get(`joinCodes/${code}`)?.uses).toBe(1);
    expect(app.db.docs.get(`families/${fid}/plans/2024-11-18`)).toEqual({ stale: true, expireAt: "2024-12-18T00:00:00.000Z" });
    expect(app.deps.pause).toHaveBeenCalledWith(JOIN_MIN_MS);
  });

  it("joins a member who has not set up yet with the careful 'setting up' profile", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    await joins(app, "dadaji", "Ramesh", code, false);
    expect(app.db.docs.get(`families/${fid}/members/dadaji`)).toMatchObject({
      name: "Ramesh",
      onboarded: false,
      activities: [],
      careTag: "none",
    });
  });

  it("answers every join error without leaking more than it should", async () => {
    const app = testApp();
    const { code } = await sharmaFamily(app);
    await signUp(app, "x", "X");
    expect(await json(await join(app, "x", "ZZZZZZZZ"))).toEqual({ kind: "not_found" });
    expect((await join(app, "x", "short")).status).toBe(404);
    expect(await json(await join(app, "neha", code))).toEqual({ kind: "already_member", familyName: "Sharma family" });
    await signUp(app, "kulkarni", "Kulkarni");
    const kulkarni = { name: "Kulkarni family", home: { name: "Kothrud", lat: 18.5, lon: 73.8, countryCode: "IN" }, homeSetup: HOME_SETUP };
    await createFamily(request("/api/family", { uid: "kulkarni", body: kulkarni }), app.deps);
    const other = await join(app, "kulkarni", code);
    expect(other.status).toBe(409);
    expect(await json(other)).toEqual({ kind: "in_other_family", familyName: "Kulkarni family" });
  });

  it("stops at 8 joins, 6 adults and after 24 hours", async () => {
    const app = testApp();
    const { fid, code } = await sharmaFamily(app);
    for (const uid of ["a1", "a2", "a3", "a4", "a5"]) await joins(app, uid, uid, code);
    const full = await joins(app, "a6", "A6", code);
    expect(full.status).toBe(409);
    expect(await json(full)).toEqual({ kind: "full", familyName: "Sharma family", adminName: "Neha" });
    app.db.docs.set(`families/${fid}`, { ...app.db.docs.get(`families/${fid}`), memberUids: ["neha"] });
    app.db.docs.set(`joinCodes/${code}`, { ...app.db.docs.get(`joinCodes/${code}`), uses: 8 });
    // An expired code names the admin's first name only, never the family.
    const expired = await json(await join(app, "a6", code));
    expect(expired).toEqual({ kind: "expired", adminName: "Neha" });
    expect(expired).not.toHaveProperty("familyName");
    app.db.docs.set(`joinCodes/${code}`, { ...app.db.docs.get(`joinCodes/${code}`), uses: 0, expiresAt: NOW.toISOString() });
    expect((await join(app, "a6", code)).status).toBe(410);
  });

  it("allows 5 tries per 10 minutes per user, kept in rateLimits for 2 days", async () => {
    const app = testApp();
    await signUp(app, "x", "X");
    for (let i = 0; i < 5; i++) await join(app, "x", "ZZZZZZZZ");
    const limited = await join(app, "x", "ZZZZZZZZ");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("600");
    expect(app.db.docs.get("rateLimits/join_x")).toMatchObject({ count: 6, expireAt: "2024-11-20T00:40:00.000Z" });
    expect((await joinFamily(request("/api/join", { uid: "x", body: { code: 5 } }), app.deps)).status).toBe(400);
  });

  it("counts attempts in a 10-minute window and a day (pure)", () => {
    const first = countAttempt(null, NOW).next;
    const later = new Date(NOW.getTime() + 11 * 60_000);
    expect(countAttempt(first, later).next.count).toBe(1);
    expect(countAttempt({ ...first, dayCount: JOIN_DAY_MAX }, later).allowed).toBe(false);
    expect(countAttempt(first, new Date(NOW.getTime() + 25 * 3_600_000)).next.dayCount).toBe(1);
  });

  it("refuses a join or a new family without the 18+ confirmation on the user doc", async () => {
    const app = testApp();
    const { code } = await sharmaFamily(app);
    await signUp(app, "kid", "Kid");
    const user = app.db.docs.get("users/kid");
    app.db.docs.set("users/kid", { ...user, adultConfirmedAt: "" });
    const refused = await join(app, "kid", code);
    expect(refused.status).toBe(403);
    expect(await json(refused)).toEqual({ kind: "not_adult" });
    const body = { name: "Kid family", home: HOME, homeSetup: HOME_SETUP };
    expect((await createFamily(request("/api/family", { uid: "kid", body }), app.deps)).status).toBe(403);
    expect(app.db.docs.get("users/kid")?.familyId).toBeNull();
  });
});
