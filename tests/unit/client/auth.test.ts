import { describe, expect, it, vi } from "vitest";
import { afterSignIn } from "@/client/afterSignIn";
import { AuthClient, signInFailure, signOut, type GoogleSignIn } from "@/client/auth";
import { savePending, type Pending } from "@/client/pending";

const PENDING: Pending = { adultConfirmed: true, joinCode: null, next: null };
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

function memoryStore(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
}

function google(over: Partial<GoogleSignIn> = {}): GoogleSignIn {
  return {
    popup: vi.fn(async () => "id-token"),
    redirect: vi.fn(async () => undefined),
    redirectResult: vi.fn(async () => "id-token"),
    signOut: vi.fn(async () => undefined),
    ...over,
  };
}

describe("AuthClient", () => {
  it("exchanges the popup's token with the 18+ tick, then signs the SDK out", async () => {
    const sdk = google();
    const fetcher = reply(200, { onboarded: false, hasFamily: false });
    const client = new AuthClient(async () => sdk, memoryStore(), fetcher);
    client.preload();
    expect(await client.popup(PENDING)).toEqual({ ok: true, state: { onboarded: false, hasFamily: false }, pending: PENDING });
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({
      idToken: "id-token",
      adultConfirmed: true,
    });
    expect(sdk.signOut).toHaveBeenCalled();
  });

  it("keeps the pending state across a redirect and finishes once", async () => {
    const store = memoryStore();
    const client = new AuthClient(async () => google(), store, reply(200, { onboarded: true, hasFamily: true }));
    expect(await client.completeRedirect()).toBeNull();
    await client.redirect({ ...PENDING, joinCode: "K7PM4QXT" });
    expect(await client.completeRedirect()).toMatchObject({ ok: true, pending: { joinCode: "K7PM4QXT" } });
    expect(await client.completeRedirect()).toBeNull();
  });

  it("reports cancelled, blocked and failed sign-ins, and a failed SDK load", async () => {
    const fail = (code: string) =>
      new AuthClient(async () => google({ popup: vi.fn(async () => Promise.reject({ code })) }), memoryStore());
    expect(await fail("auth/popup-closed-by-user").popup(PENDING)).toEqual({ ok: false, reason: "cancelled" });
    expect(await fail("auth/popup-blocked").popup(PENDING)).toEqual({ ok: false, reason: "popup_blocked" });
    expect(signInFailure(new Error("x"))).toBe("failed");
    const store = memoryStore();
    let attempts = 0;
    const flaky = new AuthClient(
      async () =>
        attempts++ === 0
          ? Promise.reject(new Error("offline"))
          : google({ redirectResult: async () => Promise.reject({ code: "auth/network" }) }),
      store,
    );
    expect(await flaky.popup(PENDING)).toEqual({ ok: false, reason: "failed" });
    savePending(store, PENDING);
    expect(await flaky.completeRedirect()).toEqual({ ok: false, reason: "failed" });
    await signOut(reply(200, {}));
    await expect(signOut(vi.fn(async () => Promise.reject(new Error("offline"))))).resolves.toBeUndefined();
  });

  it("signs the SDK out even when /api/session refuses the token", async () => {
    const sdk = google();
    const client = new AuthClient(async () => sdk, memoryStore(), reply(403, { error: "adult_required" }));
    expect(await client.popup(PENDING)).toEqual({ ok: false, reason: "failed" });
    expect(sdk.signOut).toHaveBeenCalledTimes(1);
    const stubborn = google({ signOut: vi.fn(async () => Promise.reject(new Error("x"))) });
    const second = new AuthClient(async () => stubborn, memoryStore(), reply(200, { onboarded: true, hasFamily: true }));
    expect(await second.popup(PENDING)).toMatchObject({ ok: true });
  });

  it("reports a failed redirect and drops the saved state", async () => {
    const store = memoryStore();
    const broken = new AuthClient(async () => Promise.reject(new Error("sdk")), store);
    expect(await broken.redirect(PENDING)).toEqual({ ok: false, reason: "failed" });
    const throwing = new AuthClient(async () => google({ redirect: vi.fn(async () => Promise.reject({ code: "x" })) }), store);
    expect(await throwing.redirect(PENDING)).toEqual({ ok: false, reason: "failed" });
    expect(await throwing.completeRedirect()).toBeNull();
    expect(await new AuthClient(async () => google(), store).redirect(PENDING)).toBeNull();
  });

  it("joins with a kept code after sign-in, or comes back to the invite with the error", async () => {
    vi.stubGlobal("fetch", reply(200, { kind: "joined", familyName: "Sharma family" }));
    expect(await afterSignIn({ onboarded: false, hasFamily: false }, { ...PENDING, joinCode: "K7PM4QXT" })).toBe("/onboarding");
    expect(await afterSignIn({ onboarded: true, hasFamily: false }, { ...PENDING, joinCode: "K7PM4QXT" })).toBe("/today");
    vi.stubGlobal("fetch", reply(409, { kind: "in_other_family", familyName: "Kulkarni family" }));
    expect(await afterSignIn({ onboarded: true, hasFamily: true }, { ...PENDING, joinCode: "K7PM4QXT" })).toBe(
      "/join/K7PM4QXT?error=in_other_family",
    );
    expect(await afterSignIn({ onboarded: true, hasFamily: true }, PENDING)).toBe("/today");
  });
});
