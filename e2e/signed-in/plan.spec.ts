import { expect, test, type Page } from "@playwright/test";
import { noViolations } from "./auth";
import { addChild, family } from "./flows";

/**
 * The plan slot end to end, on the "plan" project's server, which has a
 * Gemini key pointed at the local stand-in (e2e/stub/gemini.mjs). The stand-in's mode is global,
 * so this file runs its tests one after another. Plans start at 5 am in India, so that
 * server's clock is pinned to 10:00 IST (E2E_IST_CLOCK, src/server/clock.ts) and the Gemini tests run
 * at any hour. Breezy's end-to-end tests live here too, for the same stand-in and
 * the same serial order: "Papa…" asks who first, then the item lands on the plan and the kid card.
 */
test.describe.configure({ mode: "serial" });

const STUB = `http://localhost:${process.env.E2E_STUB_PORT ?? 3111}`;
const setGemini = async (mode: "ok" | "slow" | "down") => {
  const response = await fetch(`${STUB}/gemini/mode`, { method: "POST", body: JSON.stringify({ mode }) });
  expect(response.ok).toBe(true);
};

/** The page's Largest Contentful Paint, in ms from navigation start. */
const lcpOf = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries[entries.length - 1].startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );

test("a slow Gemini: the answer and the badge come first, then the Made-by line (LCP ≤ 2.5 s)", async ({ page }) => {
  test.setTimeout(90_000);
  await setGemini("slow");
  await family(page);
  await page.goto("/today");
  await expect(page.getByRole("link", { name: "Neha's plan" })).toBeVisible();
  await expect(page.getByText("Personalising today's plan…")).toBeVisible();
  expect(await lcpOf(page)).toBeLessThanOrEqual(2_500);
  await expect(page.getByText(/^Made by BreatheWell assistant \(Google Gemini\) at /)).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("Personalising today's plan…")).toBeHidden();
  await expect(page.getByText("No burning of leaves or rubbish today.")).toBeVisible();
  // axe reads colours as rendered: wait for the 300 ms cross-fade, or it sees the words half faded.
  await expect(page.locator(".plan-fade", { has: page.getByText(/^Made by BreatheWell assistant/) })).toHaveCSS("opacity", "1");
  await noViolations(page);
});

test("Gemini down: the template plan stays, labelled Simple plan, with Try again", async ({ page }) => {
  await setGemini("down");
  await family(page);
  await page.goto("/today");
  await expect(page.getByRole("link", { name: "Neha's plan" })).toBeVisible();
  await expect(page.getByText(/^Simple plan · Updated air /)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText(/^Made by BreatheWell assistant/)).toHaveCount(0);
});

test("ticking the Swap card updates this week's line", async ({ page }) => {
  await setGemini("ok");
  await family(page);
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
  await expect(page.getByText(/this week's total starts here/)).toBeVisible();
  await page.getByRole("link", { name: "Neha's plan" }).click();
  const tick = page.getByRole("checkbox", { name: "I did this swap today" });
  const [saved] = await Promise.all([page.waitForResponse("**/api/progress"), tick.check()]);
  expect(saved.status(), await saved.text()).toBe(200);
  await page.goto("/today");
  await expect(page.getByText(/^Your family avoided about .* kg CO₂ and 0 car trips this week\.$/)).toBeVisible();
});

test("Share today's plan copies one bilingual text with names and no health tags", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await setGemini("ok");
  await family(page);
  await page.goto("/today");
  await page.getByRole("button", { name: "Copy today's plan" }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Neha: ");
  expect(text).toContain("– BreatheWell");
  expect(text).toMatch(/\p{Script=Devanagari}/u);
  expect(text).not.toMatch(/Extra care|asthma|cigarette/i);
});

const ask = async (page: Page, text: string) => {
  await page.getByLabel("Your question for Breezy").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
};

test("Breezy: 'Papa…' asks who first; the checklist item then shows on that person's plan and the kid card", async ({ page }) => {
  await setGemini("ok");
  await family(page);
  const { id } = await addChild(page, "Riya");
  await page.goto("/ask");
  await expect(page.getByText(/Breezy uses today's air for Green Park/)).toBeVisible();
  await noViolations(page);
  await ask(page, "Papa's inhaler is almost finished, remind Papa");
  await expect(page.getByText('Who do you mean by "Papa"?')).toBeVisible();
  await page.getByRole("button", { name: "Neha" }).click();
  await page.getByRole("button", { name: "Add to my checklist" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Added to your checklist.")).toBeVisible();
  await page.goto("/today");
  await page.getByRole("link", { name: "Neha's plan" }).click();
  await expect(page.getByText("Check the inhaler refill today")).toBeVisible();
  await page.goto("/ask");
  await ask(page, "Give Riya an idea for school");
  await page.getByRole("button", { name: "Add to Riya's checklist" }).click();
  await expect(page.getByRole("dialog").getByText("It shows on Riya's kid card.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
  await page.getByRole("link", { name: "Open Riya's kid card" }).click();
  await expect(page).toHaveURL(new RegExp(`/kid/${id}`));
  await expect(page.getByText("Carry your water bottle")).toBeVisible();
});

test("Breezy: emergency words get the fixed text with Call 112, without asking Gemini", async ({ page }) => {
  await family(page);
  await page.goto("/ask");
  await ask(page, "chest pain since morning");
  await expect(page.getByRole("alert").filter({ hasText: "call 112" })).toContainText("call 112 or see a doctor now");
  await expect(page.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
  await noViolations(page);
});
