import { describe, expect, it, vi } from "vitest";
import { isTextSize, nextTextSize, prefCookie, TEXT_SIZE_SCRIPT } from "@/components/prefs/cookies";
import { siteMetadata } from "@/i18n/metadata";
import { localisedPath, pickLang } from "@/server/lang";

vi.mock("next/root-params", () => ({ lang: vi.fn(async () => "hi") }));

describe("preference cookies", () => {
  it("cycles Normal → Large → Extra large → Normal and checks values", () => {
    expect([nextTextSize("md"), nextTextSize("lg"), nextTextSize("xl")]).toEqual(["lg", "xl", "md"]);
    expect([isTextSize("lg"), isTextSize("huge"), isTextSize(null)]).toEqual([true, false, false]);
  });

  it("writes a year-long, site-wide, Lax cookie, Secure on HTTPS", () => {
    expect(prefCookie("bw-lang", "hi", true)).toBe("bw-lang=hi; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
    expect(prefCookie("bw-text", "lg", false)).toBe("bw-text=lg; Path=/; Max-Age=31536000; SameSite=Lax");
  });

  it("applies the saved text size before paint, and ignores junk or a missing cookie", () => {
    const root = document.documentElement;
    root.setAttribute("data-text", "md");
    document.cookie = "bw-text=xl; Path=/";
    new Function(TEXT_SIZE_SCRIPT)();
    expect(root.dataset.text).toBe("xl");
    document.cookie = "bw-text=huge; Path=/";
    root.setAttribute("data-text", "md");
    new Function(TEXT_SIZE_SCRIPT)();
    expect(root.dataset.text).toBe("md");
    document.cookie = "bw-text=; Max-Age=0; Path=/";
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
