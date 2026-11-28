import { describe, expect, it } from "vitest";
import { joinUrl } from "@/server/app/invitePages";
import { envTrust, siteOrigin } from "@/server/app/origin";

/** Links opened elsewhere (QR, WhatsApp) are always absolute and never on a client-chosen host. */
describe("siteOrigin", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  const vercel = { hosts: ["bw.vercel.app", "bw.app"], forwardedHost: false };
  const proxied = { hosts: ["bw.app"], forwardedHost: true };

  it("prefers APP_ORIGIN", () => {
    expect(siteOrigin("https://breathewell.app", h({ host: "evil.test" }))).toBe("https://breathewell.app");
  });

  it("falls back to a trusted request host: https, or http for a local host", () => {
    expect(siteOrigin(null, h({ host: "bw.vercel.app" }), vercel)).toBe("https://bw.vercel.app");
    expect(siteOrigin(null, h({ "x-forwarded-host": "bw.app, proxy", "x-forwarded-proto": "https,http" }), proxied)).toBe("https://bw.app");
    expect(siteOrigin(null, h({ host: "localhost:3100" }))).toBe("http://localhost:3100");
    expect(siteOrigin(null, h({ host: "[::1]:3000", "x-forwarded-proto": "gopher" }))).toBe("http://[::1]:3000");
    expect(siteOrigin(null, h({ host: "127.0.0.1:3000", "x-forwarded-proto": "https" }))).toBe("https://127.0.0.1:3000");
  });

  it("never builds a join link on a client-chosen Host or X-Forwarded-Host", () => {
    const viaXfh = joinUrl(siteOrigin(null, h({ host: "localhost:3000", "x-forwarded-host": "evil.example" }), vercel), "K7PM4QXT");
    const viaHost = joinUrl(siteOrigin(null, h({ host: "evil.example", "x-forwarded-proto": "http" }), vercel), "K7PM4QXT");
    const proxiedEvil = siteOrigin(null, h({ host: "bw.app", "x-forwarded-host": "evil.example" }), proxied);
    expect(new URL(viaXfh).hostname).toBe("localhost");
    expect(new URL(viaHost).hostname).toBe("localhost");
    expect(new URL(proxiedEvil).hostname).toBe("localhost");
  });

  it("trusts the hosts Vercel names, and X-Forwarded-Host only with TRUST_PROXY=1", () => {
    expect(envTrust({ VERCEL_URL: "x.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "bw.app" })).toEqual({
      hosts: ["bw.app", "x.vercel.app"],
      forwardedHost: false,
    });
    expect(envTrust({ TRUST_PROXY: "1" })).toEqual({ hosts: [], forwardedHost: true });
  });

  it("never echoes a malformed host, and the QR link is absolute", () => {
    expect(siteOrigin(null, h({ host: "a.b/<script>" }))).toBe("http://localhost:3000");
    expect(siteOrigin(null, h({}))).toBe("http://localhost:3000");
    expect(joinUrl(siteOrigin(null, h({ host: "bw.app" }), vercel), "K7PM4QXT")).toMatch(/^https:\/\/bw\.app\/join\/K7PM4QXT$/);
  });
});
