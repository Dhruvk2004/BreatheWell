import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as actions from "@/client/actions";
import { ApiRequestError, apiRequest, errorCode } from "@/client/api";
import { isInAppBrowser, openInChromeHref, prefersRedirect } from "@/client/inAppBrowser";
import { afterSignInPath, hasPending, PENDING_KEY, safeNext, savePending, takePending, type Pending } from "@/client/pending";

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

describe("api", () => {
  it("sends same-origin JSON and validates the answer", async () => {
    const fetcher = reply(200, { ok: true });
    expect(await apiRequest("/api/x", z.object({ ok: z.boolean() }), { method: "PUT", body: { a: 1 } }, fetcher)).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith("/api/x", expect.objectContaining({ method: "PUT", credentials: "same-origin", body: '{"a":1}' }));
  });

  it("carries the server's code, or a join outcome's kind, and the whole body", async () => {
    const error = await apiRequest("/api/x", z.unknown(), {}, reply(409, { error: { code: "too_many", message: "Full" } })).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(errorCode(error)).toBe("too_many");
    const join = (await apiRequest("/api/join", z.unknown(), {}, reply(410, { kind: "expired", adminName: "Neha" })).catch(
      (e: unknown) => e,
    )) as ApiRequestError;
    expect([join.code, join.body.adminName]).toEqual(["expired", "Neha"]);
    const broken = (await apiRequest(
      "/x",
      z.unknown(),
      {},
      vi.fn(async () => new Response("oops", { status: 500 })),
    ).catch((e: unknown) => e)) as ApiRequestError;
    expect([broken.code, broken.message]).toEqual(["http_error", "Something went wrong. Try again."]);
    expect(errorCode(new Error("offline"))).toBe("network");
  });

  it("names one route per action", async () => {
    const f = reply(200, { ok: true, code: "K7PM4QXT", expiresAt: "x", familyId: "f", id: "d", done: [], kind: "joined", familyName: "F" });
    await actions.saveProfile({} as never, f);
    await actions.createFamily({} as never, f);
    await actions.updateFamily({}, f);
    await actions.deleteFamily("F", f);
    await actions.joinFamily("K7PM4QXT", f);
    await actions.newCode(f);
    await actions.leaveFamily(f);
    await actions.removeMember("u/1", f);
    await actions.addDependent({} as never, f);
    await actions.updateDependent("d", {} as never, f);
    await actions.deleteDependent("d", f);
    await actions.tickProgress("u", "k", true, f);
    await actions.tickItem("i", false, f);
    await actions.deleteAccount(f);
    const routes = (f.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => `${init.method} ${url}`);
    expect(routes).toEqual([
      "PUT /api/profile",
      "POST /api/family",
      "PATCH /api/family",
      "DELETE /api/family",
      "POST /api/join",
      "POST /api/family/code",
      "POST /api/family/leave",
      "DELETE /api/family/members/u%2F1",
      "POST /api/dependent",
      "PUT /api/dependent/d",
      "DELETE /api/dependent/d",
      "POST /api/progress",
      "PATCH /api/items/i",
      "DELETE /api/account",
    ]);
  });
});

describe("pending sign-in state (spec 5.3, 10.4)", () => {
  it("survives the redirect once, and only ours", () => {
    const store = memoryStore();
    expect(hasPending(store)).toBe(false);
    savePending(store, { ...PENDING, joinCode: "K7PM4QXT", next: "/today" });
    expect(hasPending(store)).toBe(true);
    expect(takePending(store)).toMatchObject({ joinCode: "K7PM4QXT", next: "/today" });
    expect(takePending(store)).toBeNull();
    store.setItem(PENDING_KEY, '{"adultConfirmed":false}');
    expect(takePending(store)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    expect(() => savePending(broken, PENDING)).not.toThrow();
    expect(takePending(broken)).toBeNull();
    expect(hasPending(broken)).toBe(false);
  });

  it("never redirects to another origin", () => {
    expect(["/today?x=1", "//evil.example", "https://evil.example", "/\\evil", null].map(safeNext)).toEqual([
      "/today?x=1",
      null,
      null,
      null,
      null,
    ]);
    expect(afterSignInPath({ onboarded: true, hasFamily: true }, "/profile")).toBe("/profile");
    expect(afterSignInPath({ onboarded: true, hasFamily: true }, null)).toBe("/today");
    expect(afterSignInPath({ onboarded: true, hasFamily: false }, "/profile")).toBe("/onboarding");
  });
});

describe("in-app browsers (spec 10.4)", () => {
  const ANDROID_IG = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Instagram 300.0.0";
  it("detects WebViews and opens Chrome with an intent on Android", () => {
    expect(isInAppBrowser(ANDROID_IG)).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Macintosh) Chrome/131")).toBe(false);
    expect(openInChromeHref("https://app.test/join/K7PM4QXT?x=1", ANDROID_IG)).toBe(
      "intent://app.test/join/K7PM4QXT?x=1#Intent;scheme=https;package=com.android.chrome;end",
    );
    expect(openInChromeHref("https://app.test/sign-in", "iPhone")).toBe("https://app.test/sign-in");
    expect([prefersRedirect(ANDROID_IG), prefersRedirect("Macintosh")]).toEqual([true, false]);
  });
});
