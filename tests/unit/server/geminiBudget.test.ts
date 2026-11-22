import { describe, expect, it } from "vitest";
import { reserveBreezyQuestion } from "@/server/repos/breezyQuota";
import { dailyBudget, GEMINI_LIMITS, geminiLimits, reserveGeminiCall } from "@/server/repos/quota";
import { MemoryDb } from "../../helpers/memoryDb";
import { NOW } from "../../helpers/airDeps";

/** Spec 7.8 protects plans first (stage 7 AUTH-5, PT-4): Breezy cannot spend the plans' share. */
const minute = (n: number) => new Date(NOW.getTime() + n * 60_000);

describe("Gemini sub-budgets per placement", () => {
  it("an honest family still gets its plan call after 7 throwaway accounts max out their Breezy caps", async () => {
    const db = new MemoryDb();
    let at = 0;
    let granted = 0;
    for (let a = 0; a < 7; a++)
      for (let q = 0; q < 30; q++) {
        if ((a * 30 + q) % 7 === 0) at += 1; // 7 a minute: Breezy's share of the 10 rpm
        if (
          (await reserveBreezyQuestion(db, `throwaway${a}`, `fam${a}`, minute(at))) &&
          (await reserveGeminiCall(db, "breezy", minute(at)))
        )
          granted += 1;
      }
    expect(granted).toBe(Math.floor(dailyBudget(GEMINI_LIMITS) * 0.5));
    expect(await reserveGeminiCall(db, "plan", minute(at + 1))).toBe(true);
  });

  it("a burst of Breezy questions in one minute leaves 3 calls for plans", async () => {
    const db = new MemoryDb();
    let breezy = 0;
    for (let i = 0; i < 10; i++) if (await reserveGeminiCall(db, "breezy", NOW)) breezy += 1;
    expect(breezy).toBe(GEMINI_LIMITS.rpm - 3);
    for (let i = 0; i < 3; i++) expect(await reserveGeminiCall(db, "plan", NOW)).toBe(true);
    expect(await reserveGeminiCall(db, "plan", NOW)).toBe(false);
  });

  it("community may use a quarter of the day's budget", async () => {
    const db = new MemoryDb();
    const limits = { rpd: 100, rpm: 1000 };
    let community = 0;
    for (let i = 0; i < 40; i++) if (await reserveGeminiCall(db, "community", NOW, limits)) community += 1;
    expect(community).toBe(20);
    expect(await reserveGeminiCall(db, "plan", NOW, limits)).toBe(true);
  });

  it("raises the per-minute limit for the E2E stand-in only on a demo project", () => {
    expect(geminiLimits({ E2E_GEMINI_RPM: "100", FIREBASE_PROJECT_ID: "demo-breathewell" })).toEqual({ rpd: 250, rpm: 100 });
    expect(geminiLimits({ E2E_GEMINI_RPM: "100", FIREBASE_PROJECT_ID: "breathewell-prod" })).toEqual(GEMINI_LIMITS);
    expect(geminiLimits({ E2E_GEMINI_RPM: "x", FIREBASE_PROJECT_ID: "demo-breathewell" })).toEqual(GEMINI_LIMITS);
    expect(geminiLimits({})).toEqual(GEMINI_LIMITS);
  });
});
