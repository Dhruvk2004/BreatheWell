import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Slice 1 smoke test: the shell renders with no keys set, switches language, and passes axe. */
test("landing renders and switches to Hindi with no axe violations; there is no text-size button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Can your family go out today?");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: "Switch to Hindi" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("क्या आज आपका परिवार बाहर जा सकता है?");
  await expect(page.getByText("Aa", { exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the server renders the saved language on the next visit, with no switch after load", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "bw-lang", value: "hi", url: baseURL }]);
  const response = await page.goto("/");
  const html = (await response?.text()) ?? "";
  expect(html).toContain('<html lang="hi"');
  expect(html).toContain("क्या आज आपका परिवार बाहर जा सकता है?");
});

test("a Hindi browser gets Hindi by default", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: "hi-IN", baseURL });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await context.close();
});

test("sends the security headers", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test("unknown pages get the bilingual 404", async ({ page }) => {
  const response = await page.goto("/nowhere");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find this page." })).toBeVisible();
});

test("without Firebase, sign-in says it isn't configured and signed-in pages lead there", async ({ page, request }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Ftoday/);
  await expect(page.getByText("Sign-in isn't configured on this deployment.")).toBeVisible();
  await expect(page.getByRole("link", { name: "See the sample family" })).toHaveAttribute("href", "/demo");
  expect((await request.post("/api/family", { data: {}, headers: { origin: "http://localhost:3100" } })).status()).toBe(503);
});
