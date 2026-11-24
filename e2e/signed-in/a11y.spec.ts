import { expect, test } from "@playwright/test";
import { noViolations } from "./auth";
import { addChild, family } from "./flows";

// Axe on the signed-in pages in English and Hindi, desktop and phone.

for (const lang of ["en", "hi"] as const) {
  test(`Today, profile and family settings pass axe (${lang})`, async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "bw-lang", value: lang, url: baseURL }]);
    await family(page);
    for (const path of ["/today", "/ask", "/learn", "/profile", "/family/settings", "/dependent/new", "/join"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await noViolations(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  });
}

test("Member plan, Join, Edit child and both full-screen views pass axe", async ({ page, browser, baseURL }) => {
  const code = await family(page);
  const { id } = await addChild(page, "Riya");
  for (const path of ["/today", `/dependent/${id}`, `/member/${id}`]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await noViolations(page);
  }
  await page.goto(`/kid/${id}`);
  await page.getByRole("button", { name: "Show full screen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noViolations(page);
  await page.goto("/family/invite");
  await page.getByRole("button", { name: "Show QR full screen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noViolations(page);
  const visitor = await (await browser.newContext({ baseURL })).newPage();
  await visitor.goto(`/join/${code}`);
  await expect(visitor.locator("h1")).toBeVisible();
  await noViolations(visitor);
});
