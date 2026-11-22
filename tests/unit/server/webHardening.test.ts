import { describe, expect, it } from "vitest";
import { z } from "zod";
import { addBasePath } from "next/dist/client/add-base-path";
import robots from "@/app/robots";
import { afterSignInPath, safeNext, savePending, takePending } from "@/client/pending";
import { publicPlaceName } from "@/domain/geo/placeName";
import { parsePlaceQuery } from "@/server/air/query";
import { helperRequestHeaders } from "@/server/csp";
import { deleteDependent } from "@/server/handlers/dependent";
import { MAX_BODY_BYTES, pausedOnQuota, readJson } from "@/server/http";
import { addressKey, checkClient, clientKey, proxyTrust, RateLimiter } from "@/server/rateLimit";
import { paths, segment } from "@/server/repos/paths";
import { request, testApp } from "../../helpers/appDeps";
import { sharmaFamily } from "../../helpers/family";

/** Stage 7 WEB-1, WEB-3, WEB-7, PT-1, PT-5 to PT-8, PT-10 and PT-11. */
const store = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe("no open redirect after sign-in (WEB-1, PT-1)", () => {
  it.each(["/%09/evil.example/login", "/%0A/evil.example/login", "/%0D/evil.example/login", "/%5C/evil.example", "/%20/evil.example"])(
    "keeps %s on the app origin through the whole sign-in round trip",
    (raw) => {
      const next = safeNext(new URLSearchParams(`next=${raw}`).get("next"));
      const pending = store();
      savePending(pending, { adultConfirmed: true, joinCode: null, next });
      const href = afterSignInPath({ onboarded: true, hasFamily: true }, takePending(pending)?.next ?? null);
      expect(new URL(addBasePath(href), "https://breathewell.app/en/sign-in").origin).toBe("https://breathewell.app");
    },
  );

  it("keeps an ordinary path, its query and hash", () => {
    expect(safeNext("/member/abc?tab=plan#today")).toBe("/member/abc?tab=plan#today");
    expect(safeNext("/./%2e%2e/today")).toBe("/today");
    expect(safeNext("/.//evil.example/login")).toBeNull();
    expect(safeNext("/to\tday")).toBeNull();
  });
});

describe("per-IP keys come only from addresses the host vouches for (WEB-3, PT-6)", () => {
  const rotate = (make: (i: number) => Record<string, string>, trust = proxyTrust({})) => {
    const limiter = new RateLimiter(10, 60_000, () => 0);
    let allowed = 0;
    for (let i = 0; i < 100; i += 1) if (checkClient(limiter, new Headers(make(i)), trust).allowed) allowed += 1;
    return allowed;
  };

  it("ignores a client-set X-Forwarded-For off Vercel without a trusted proxy", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4" }), proxyTrust({}))).toBeNull();
    expect(rotate((i) => ({ "x-forwarded-for": `1.2.3.${i}` }))).toBeLessThanOrEqual(10 * 20);
    expect(rotate((i) => ({ "x-forwarded-for": `1.2.3.${i}` }), proxyTrust({ TRUST_PROXY: "1" }))).toBe(100);
  });

  it("on Vercel uses the platform's own header and treats one IPv6 /64 as one client", () => {
    const vercel = proxyTrust({ VERCEL: "1" });
    const spoofed = clientKey(new Headers({ "x-vercel-forwarded-for": "203.0.113.5", "x-forwarded-for": "6.6.6.6" }), vercel);
    expect(spoofed).toBe(clientKey(new Headers({ "x-real-ip": "203.0.113.5" }), vercel));
    expect(rotate((i) => ({ "x-vercel-forwarded-for": `2001:db8:1:2::${i.toString(16)}` }), vercel)).toBe(10);
    expect(addressKey("2001:db8:1:2:aa:bb:cc:dd")).toBe("2001:db8:1:2");
    expect(addressKey("[2001:db8::1]:443")).toBe("2001:db8:0:0");
    expect(addressKey("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(addressKey("198.51.100.7")).toBe("198.51.100.7");
  });
});

describe("oversized bodies are never buffered (WEB-7, PT-5)", () => {
  it("refuses a large Content-Length before reading, and stops a stream soon after the limit", async () => {
    let pulled = 0;
    const chunk = new Uint8Array(64 * 1024).fill(0x20);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= 2 * 1024 * 1024) return controller.close();
        pulled += chunk.length;
        controller.enqueue(chunk);
      },
    });
    const init = { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" };
    const streamed = await readJson(new Request("http://localhost/api/session", init as RequestInit), z.object({}));
    expect(streamed.ok || streamed.response.status).toBe(413);
    expect(pulled).toBeLessThanOrEqual(MAX_BODY_BYTES + 2 * chunk.length);
    const declared = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "99999999" },
    });
    const early = await readJson(declared, z.object({}));
    expect(early.ok || early.response.status).toBe(413);
    const fine = new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":"ना"}' });
    expect(await readJson(fine, z.object({ a: z.string() }))).toEqual({ ok: true, data: { a: "ना" } });
  });
});

describe("public place names and path ids (PT-7, PT-8)", () => {
  it("shows coordinates instead of a crafted place with a phone number or a sentence", () => {
    expect(publicPlaceName("Call 9810012345 for free N95")).toBeUndefined();
    expect(publicPlaceName("Green Park, New Delhi")).toBe("Green Park, New Delhi");
    expect(parsePlaceQuery({ lat: "28.61", lon: "77.21", place: "Call 9810012345 for free N95" })?.place).toBeUndefined();
  });

  it("refuses an id that is not one path segment, and the route answers 404", async () => {
    expect(() => paths.dependent("f1", "../../f2/dependents/d1")).toThrow("invalid_path_id");
    expect(() => paths.item("f1", "x/y/z")).toThrow();
    expect(segment("Abc_123-x")).toBe("Abc_123-x");
    const app = testApp();
    await sharmaFamily(app);
    const call = request("/api/dependent/x", { method: "DELETE", uid: "neha" });
    expect((await pausedOnQuota(deleteDependent(call, app.deps, "../../other/dependents/d1"))).status).toBe(404);
  });
});

describe("the auth helper proxy and 404 caching (PT-10, PT-11)", () => {
  it("never forwards cookies or client-address headers to firebaseapp.com", () => {
    const sent = helperRequestHeaders(
      new Headers({ cookie: "__session=x", "x-forwarded-for": "1.2.3.4", accept: "text/html", authorization: "b" }),
    );
    expect([...sent.keys()]).toEqual(["accept"]);
  });

  it("serves a robots.txt that keeps crawlers off the API and the auth helper", () => {
    expect(robots()).toEqual({ rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/__/"] }] });
  });
});
