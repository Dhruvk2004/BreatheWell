import { describe, expect, it, vi } from "vitest";
import { prefCookie } from "@/i18n/prefCookies";
import { siteMetadata } from "@/i18n/metadata";
import { localisedPath, pickLang } from "@/server/lang";

vi.mock("next/root-params", () => ({ lang: vi.fn(async () => "hi") }));

describe("preference cookies", () => {
  it("writes a year-long, site-wide, Lax cookie, Secure on HTTPS", () => {
    expect(prefCookie("bw-lang", "hi", true)).toBe("bw-lang=hi; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
    expect(prefCookie("bw-lang", "en", false)).toBe("bw-lang=en; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});

describe("language routing (proxy decisions)", () => {
  it("uses the saved language, else Hindi when the browser prefers it, else English", () => {
    expect(pickLang("hi", "en-US")).toBe("hi");
    expect(pickLang("en", "hi-IN")).toBe("en");
    expect(pickLang("fr", "hi-IN,hi;q=0.9,en;q=0.8")).toBe("hi");
    expect(pickLang(undefined, "en-IN,hi;q=0.9")).toBe("en");
    expect(pickLang(undefined, null)).toBe("en");
  });

  it("rewrites pages under their language segment once", () => {
    expect(localisedPath("/", "hi")).toBe("/hi");
    expect(localisedPath("/air", "en")).toBe("/en/air");
    expect(localisedPath("/hi/air", "en")).toBeNull();
    expect(localisedPath("/en", "hi")).toBeNull();
    expect(localisedPath("/english-tips", "hi")).toBe("/hi/english-tips");
  });

  it("reads the page language from the root segment and titles the site in it", async () => {
    const { currentLang } = await import("@/i18n/server");
    expect(await currentLang()).toBe("hi");
    expect(siteMetadata("hi").description).toContain("BreatheWell");
    expect(siteMetadata("en").title).toEqual({ default: "BreatheWell · Can your family go out today?", template: "%s · BreatheWell" });
  });
});
