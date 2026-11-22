import { describe, expect, it } from "vitest";
import type { InFamily, SignedIn } from "@/server/app/guards";
import { loadMember, loadToday } from "@/server/app/todayPage";
import { loadViewer } from "@/server/app/viewer";
import { requestPlan } from "@/server/handlers/plan";
import { progressTotals } from "@/domain/impact/progress";
import { budgetLeft, quotaDay, reserveGeminiCall } from "@/server/repos/quota";
import { json, request, testApp, type TestApp } from "../../helpers/appDeps";
import { NOW } from "../../helpers/airDeps";
import { addRiya, joins, sharmaFamily } from "../../helpers/family";
import { fakeModel, replyToPrompt } from "../../helpers/planReply";

/** Today and Member plan with stored Gemini words (spec 7.2, 10.8, 10.9), the weekly line and the share text. */
const DATE = "2024-11-18";
/** Gemini's quota day for 6:10 am IST on 18 Nov: still 17 Nov in California. */
const QUOTA_DAY = "2024-11-17";
const inFamily = async (app: TestApp, uid: string) => (await loadViewer(`session:${uid}`, app.deps)) as SignedIn as InFamily;

async function family(generate = true) {
  const app = testApp({ gemini: fakeModel((r) => replyToPrompt(r.prompt)) });
  const { fid, code } = await sharmaFamily(app);
  await joins(app, "rahul", "Rahul", code);
  await joins(app, "dadaji", "Ramesh", code, false);
  const riya = await addRiya(app);
  if (generate) await requestPlan(request("/api/plan", { uid: "neha", body: {} }), app.deps);
  return { app, fid, riya };
}

describe("Today with the family plan", () => {
  it("asks for a plan when none exists today, and never without Gemini", async () => {
    const { app } = await family(false);
    const page = await loadToday(await inFamily(app, "neha"), app.deps);
    expect(page.words).toMatchObject({ source: "template", pending: true, capped: false, canRetry: false, rows: {} });
    const plain = await loadToday(await inFamily(app, "neha"), { ...app.deps, gemini: null });
    expect(plain.words.pending).toBe(false);
  });

  it("shows Gemini's lines with names filled in, in the family's languages only", async () => {
    const { app, riya } = await family();
    const page = await loadToday(await inFamily(app, "rahul"), app.deps, "en");
    expect(page.words.source).toBe("gemini");
    expect(page.words.pending).toBe(false);
    expect(page.words.rows[riya]).toMatch(/^Riya: /);
    expect(page.words.rows.neha).toMatch(/^Neha: /);
    expect(Object.keys(page.words.home)).toHaveLength(1);
    expect(page.words.together?.doThis).toContain("burning");
    const hindi = await loadToday(await inFamily(app, "rahul"), app.deps, "hi");
    expect(hindi.words).toMatchObject({ source: "template", rows: {} });
  });

  it("falls back item by item when a rule changed since generation or a person left", async () => {
    const { app, fid, riya } = await family();
    const path = `families/${fid}/plans/${DATE}/members/${riya}`;
    const section = app.db.docs.get(path) as { items: Record<string, { rule: { bestTime: number | null } }>; line: object };
    const [first] = Object.keys(section.items);
    section.items[first].rule.bestTime = 23;
    app.db.docs.set(path, { ...section, line: { ...section.line, activityId: "elsewhere" } });
    const plan = app.db.docs.get(`families/${fid}/plans/${DATE}`) as { tokens: Record<string, string> };
    app.db.docs.set(`families/${fid}/plans/${DATE}`, { ...plan, tokens: { ...plan.tokens, m1: "gone" } });
    const page = await loadToday(await inFamily(app, "neha"), app.deps);
    expect(page.words.rows[riya]).toBeUndefined();
    expect(page.words.rows.neha).toBeUndefined();
    expect(page.words.items[riya][first]).toBeUndefined();
    expect(Object.keys(page.words.items[riya]).length).toBeGreaterThan(0);
  });

  it("offers Try again on a Simple plan and says so once 3 generations are used", async () => {
    const { app, fid } = await family(false);
    const path = `families/${fid}/plans/${DATE}`;
    app.db.docs.set(path, { source: "template", generations: 1, generatedAt: NOW.toISOString() });
    expect((await loadToday(await inFamily(app, "neha"), app.deps)).words).toMatchObject({ canRetry: true, pending: false });
    app.db.docs.set(path, { source: "gemini", generations: 3, stale: true });
    expect((await loadToday(await inFamily(app, "neha"), app.deps)).words).toMatchObject({ capped: true, pending: false });
    app.db.docs.set(`quota/${QUOTA_DAY}`, { geminiCalls: 999 });
    app.db.docs.delete(path);
    expect((await loadToday(await inFamily(app, "neha"), app.deps)).words.pending).toBe(false);
  });

  it("builds the bilingual share text from code (no health tags, no numbers but times)", async () => {
    const { app } = await family();
    const { shareText } = await loadToday(await inFamily(app, "neha"), app.deps);
    const [en, hi] = (shareText ?? "").split("\n\n");
    expect(en).toMatch(/^Today in Green Park, New Delhi: Very poor\. Neha: .* – BreatheWell$/);
    expect(en).toContain("Riya:");
    expect(en).not.toMatch(/asthma|cigarette|Ramesh/i);
    expect(hi).toMatch(/^आज Green Park, New Delhi में हवा: बहुत खराब।/);
  });

  it("sums the week's ticked swaps into the weekly line", async () => {
    const { app, fid } = await family(false);
    const tick = (date: string, co2AvoidedKg: number, carTrips?: number) =>
      app.db.docs.set(`families/${fid}/progress/${date}_neha`, {
        forId: "neha",
        date,
        done: {},
        protectedHours: 1,
        co2AvoidedKg,
        ...(carTrips === undefined ? {} : { carTrips }),
      });
    tick("2024-11-18", 1.5, 1);
    tick("2024-11-13", 2);
    tick("2024-11-11", 9, 9); // eight days ago: not this week
    app.db.docs.set(`families/${fid}/progress/2024-11-17_x`, { date: "2024-11-17", broken: true });
    expect((await loadToday(await inFamily(app, "neha"), app.deps)).week).toEqual({ co2Kg: 3.5, carTrips: 1 });
    const activity = { id: "o", type: "office_trip" as const, usual: "09:00", flex: "fixed" as const, duration: "15to60" as const };
    const plan = {
      activityId: "o",
      date: DATE,
      usualHour: 9,
      verdictAtUsual: "care" as const,
      suggestion: "switch_mode" as const,
      bestTime: null,
      verdictAtBest: null,
      switchTo: "metro" as const,
      tomorrowBest: null,
      notes: [],
    };
    expect(progressTotals([{ activity, plan }], { main: "car", tripLength: "15to45" }).carTrips).toBe(1);
    expect(progressTotals([{ activity, plan }], { main: "two_wheeler", tripLength: "15to45" }).carTrips).toBe(0);
  });
});

describe("Member plan with the family plan", () => {
  it("shows Gemini's item words and a swap code allows, else the first allowed swap", async () => {
    const { app } = await family();
    const page = await loadMember(await inFamily(app, "neha"), "neha", app.deps);
    expect(Object.values(page?.words.items.neha ?? {})[0]?.doThis).toMatch(/^Neha: /);
    expect(page?.swap).toEqual({ altId: "metro_for_scooter", words: null });
    const { app: other, fid } = await family();
    const path = `families/${fid}/plans/${DATE}/members/neha`;
    other.db.docs.set(path, {
      ...other.db.docs.get(path),
      swap: { altId: "metro_for_scooter", doThis: { en: "{m1}: metro today." }, why: { en: "Less smoke." } },
    });
    const swapped = await loadMember(await inFamily(other, "neha"), "neha", other.deps);
    expect(swapped?.swap).toEqual({ altId: "metro_for_scooter", words: { doThis: "Neha: metro today.", why: "Less smoke." } });
    other.db.docs.set(path, { ...other.db.docs.get(path), swap: { altId: "made_up", doThis: { en: "x" } } });
    expect((await loadMember(await inFamily(other, "neha"), "neha", other.deps))?.swap?.words).toBeNull();
  });
});

describe("Gemini budget (spec 7.8)", () => {
  it("counts on Google's quota day (midnight Pacific), not the Indian date", async () => {
    const lateIst = new Date("2024-11-18T17:30:00Z"); // 11 pm IST on 18 Nov
    const nextIstMorning = new Date("2024-11-18T19:30:00Z"); // 1 am IST on 19 Nov
    expect(quotaDay(lateIst)).toBe("2024-11-18");
    expect(quotaDay(nextIstMorning)).toBe("2024-11-18");
    expect(quotaDay(new Date("2024-11-19T08:30:00Z"))).toBe("2024-11-19"); // 2 pm IST: a new Google day
    const app = testApp();
    const limits = { rpd: 3, rpm: 10 };
    expect(await reserveGeminiCall(app.db, "plan", lateIst, limits)).toBe(true);
    expect(await reserveGeminiCall(app.db, "plan", lateIst, limits)).toBe(true);
    expect(await reserveGeminiCall(app.db, "plan", nextIstMorning, limits)).toBe(false); // same Google day: 80% of 3 is spent
    expect(app.db.docs.get("quota/2024-11-18")).toMatchObject({ geminiCalls: 2 });
  });

  it("counts calls per placement and per minute, and stops at 80% of RPD or the RPM", async () => {
    const app = testApp();
    const limits = { rpd: 10, rpm: 5 };
    expect(await reserveGeminiCall(app.db, "plan", NOW, limits)).toBe(true);
    expect(await reserveGeminiCall(app.db, "breezy", NOW, limits)).toBe(true);
    expect(await reserveGeminiCall(app.db, "breezy", NOW, limits)).toBe(false); // the minute's last 3 calls are for plans
    for (let i = 0; i < 3; i++) expect(await reserveGeminiCall(app.db, "plan", NOW, limits)).toBe(true);
    expect(await reserveGeminiCall(app.db, "plan", NOW, limits)).toBe(false); // RPM
    const later = new Date(NOW.getTime() + 60_000);
    expect(app.db.docs.get(`quota/${QUOTA_DAY}`)).toMatchObject({ geminiCalls: 5, byPlacement: { plan: 4, breezy: 1 }, minuteCount: 5 });
    for (let i = 0; i < 3; i++) await reserveGeminiCall(app.db, "plan", new Date(later.getTime() + i * 60_000), limits);
    expect(await reserveGeminiCall(app.db, "plan", new Date(later.getTime() + 600_000), limits)).toBe(false); // 8 = 80% of 10
    expect(await budgetLeft(app.db, NOW, limits)).toBe(false);
    app.db.docs.set(`quota/${QUOTA_DAY}`, { geminiCalls: "bad" });
    expect(await budgetLeft(app.db, NOW, limits)).toBe(true);
    expect(await reserveGeminiCall(app.db, "plan", NOW, limits)).toBe(true);
    expect(await json(await requestPlan(request("/api/plan", { uid: "nobody", body: {} }), app.deps))).toMatchObject({ error: {} });
  });
});
