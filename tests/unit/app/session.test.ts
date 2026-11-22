import { describe, expect, it } from "vitest";
import { authorize } from "@/server/auth/guard";
import { accountCookieHeader, clearedCookies, readCookie, secureCookies, sessionCookieHeader } from "@/server/auth/cookies";
import { createSession, deleteSession, RECENT_SIGN_IN_S } from "@/server/handlers/session";
import { json, request, testApp } from "../../helpers/appDeps";

const signIn = (body: unknown, ip = "198.51.100.1") => request("/api/session", { body, ip });

describe("POST /api/session (spec 10.4, 7.0)", () => {
  it("needs the 18+ tick: without it nothing is stored and no cookie is set", async () => {
    const { deps, db } = testApp();
    for (const body of [{ idToken: "token:u1:Asha" }, { idToken: "token:u1:Asha", adultConfirmed: false }]) {
      const response = await createSession(signIn(body), deps);
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(db.docs.size).toBe(0);
  });

  it("creates the profile with the Google first name, sets both cookies and refreshes adultConfirmedAt", async () => {
    const { deps, db } = testApp();
    const response = await createSession(signIn({ idToken: "token:u1:Neha Sharma", adultConfirmed: true }), deps);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ onboarded: false, hasFamily: false });
    const cookies = response.headers.getSetCookie();
    expect(cookies[0]).toMatch(/^__session=session%3Au1; Path=\/; Max-Age=432000; HttpOnly; SameSite=Lax; Secure$/);
    expect(cookies[1]).toMatch(/^bw-acct=N;/);
    expect(db.docs.get("users/u1")).toMatchObject({
      name: "Neha",
      familyId: null,
      onboarded: false,
      adultConfirmedAt: "2024-11-18T00:40:00.000Z",
    });
    await createSession(signIn({ idToken: "token:u1:Other", adultConfirmed: true }, "198.51.100.2"), deps);
    expect(db.docs.get("users/u1")?.name).toBe("Neha");
  });

  it("refuses another origin, a bad or old token, and more than 10 a minute per IP", async () => {
    const { deps, auth } = testApp();
    expect((await createSession(request("/api/session", { body: {}, origin: "https://evil.example" }), deps)).status).toBe(403);
    expect((await createSession(signIn({ idToken: "nope", adultConfirmed: true }), deps)).status).toBe(401);
    auth.authTime -= RECENT_SIGN_IN_S + 1;
    expect((await createSession(signIn({ idToken: "token:u1:A", adultConfirmed: true }, "198.51.100.3"), deps)).status).toBe(401);
    for (let i = 0; i < 10; i++) await createSession(signIn({}, "198.51.100.4"), deps);
    expect((await createSession(signIn({}, "198.51.100.4"), deps)).status).toBe(429);
  });

  it("says sign-in isn't configured without Firebase", async () => {
    const { deps } = testApp({ db: null, auth: null, sessions: null });
    const response = await createSession(signIn({}), deps);
    expect(response.status).toBe(503);
    expect((await json<{ error: { code: string } }>(response)).error.code).toBe("not_configured");
  });
});

describe("DELETE /api/session and the guard", () => {
  it("revokes the session and clears both cookies", async () => {
    const { deps, auth } = testApp();
    const response = await deleteSession(request("/api/session", { method: "DELETE", uid: "u1" }), deps);
    expect(auth.revoked).toEqual(["u1"]);
    expect(response.headers.getSetCookie().every((c) => c.includes("Max-Age=0"))).toBe(true);
    expect((await deleteSession(request("/api/session", { method: "DELETE", origin: "https://evil.example" }), deps)).status).toBe(403);
    const anonymous = await deleteSession(request("/api/session", { method: "DELETE" }), testApp({ auth: null, sessions: null }).deps);
    expect(anonymous.status).toBe(200);
  });

  it("checks origin, cookie, revocation and the per-user write limit", async () => {
    const { deps, auth } = testApp();
    const bad = await authorize(request("/x", { uid: "u1", origin: null }), deps, "write");
    expect(bad.ok || bad.response.status).toBe(403);
    const none = await authorize(request("/x"), deps, "read");
    expect(none.ok || none.response.status).toBe(401);
    const stale = await authorize(new Request("https://app.test/x", { headers: { cookie: "__session=junk" } }), deps, "read");
    expect(stale.ok || stale.response.headers.getSetCookie().length).toBe(2);
    auth.validAfter.u2 = new Date(auth.authTime * 1000 + 1000).toISOString();
    const revoked = await authorize(request("/x", { uid: "u2" }), deps, "write");
    expect(revoked.ok).toBe(false);
    // Reads check revocation too: a copied cookie stops after "Sign out everywhere" (stage 7 AUTH-1).
    expect((await authorize(request("/x", { uid: "u2" }), deps, "read")).ok).toBe(false);
    for (let i = 0; i < 60; i++) await authorize(request("/x", { uid: "u3" }), deps, "write");
    const limited = await authorize(request("/x", { uid: "u3" }), deps, "write");
    expect(limited.ok || limited.response.status).toBe(429);
  });
});

describe("cookies", () => {
  it("reads, writes and clears them", () => {
    expect(readCookie("a=1; __session=x%20y", "__session")).toBe("x y");
    expect(readCookie("__session=%E0%A4", "__session")).toBeNull();
    expect(readCookie(null, "a")).toBeNull();
    expect(sessionCookieHeader("v", false)).not.toContain("Secure");
    expect(accountCookieHeader("NS", true)).toContain("bw-acct=NS");
    expect(clearedCookies(true)).toHaveLength(2);
    expect(secureCookies("http://localhost:3100")).toBe(false);
    expect(secureCookies(null)).toBe(true);
  });
});
