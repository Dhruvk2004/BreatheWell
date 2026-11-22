import { expect, test } from "@playwright/test";
import { noViolations } from "./auth";
import { family } from "./flows";

// Spec 10.4, 7.0, 11.4: the adult tick comes before any sign-in, and "I'm under 18" leaves nothing behind.

test("Continue with Google stays disabled until the 18+ tick; the screen passes axe", async ({ page }) => {
  await page.goto("/sign-in");
  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(button).toBeDisabled();
  await expect(page.getByText("Tick the box above to continue.")).toBeVisible();
  await noViolations(page);
  await page.getByRole("checkbox", { name: /I am 18 or older/ }).check();
  await expect(button).toBeEnabled();
});

test("'I'm under 18' on Sign-in and on Join: no Auth user, no users doc, no member doc, no code used", async ({ page, browser }) => {
  const admin = await browser.newPage();
  const code = await family(admin);
  // Other tests sign people in at the same time, so totals would race: instead no request may
  // reach the session route, Google or the Auth emulator from this page at all.
  const signInCalls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/session|identitytoolkit|securetoken|\/emulator\/auth/.test(r.url())) signInCalls.push(r.url());
  });
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "I'm under 18" }).click();
  await expect(page.getByText(/Ask a parent to add you to their family/)).toBeVisible();
  await page.goto(`/join/${code}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neha invited you to Neha's family on BreatheWell.");
  await expect(page.getByRole("button", { name: "Sign in with Google to join" })).toBeDisabled();
  await page.getByRole("button", { name: "I'm under 18" }).click();
  await expect(page.getByText(/BreatheWell accounts are for adults/).first()).toBeVisible();
  expect(signInCalls).toEqual([]);
  await admin.goto("/family/settings");
  await expect(admin.getByText(/Joined via code/)).toHaveCount(0);
});

test("signed-in pages send a signed-out visitor to Sign-in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Ftoday/);
});
