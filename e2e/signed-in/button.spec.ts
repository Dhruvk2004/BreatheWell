import { devices, expect, test } from "@playwright/test";
import { BASE_URL, signInWithButton, signInWithRedirect } from "./auth";
import { family } from "./flows";

// Spec 10.4, 5.3 (review fix): the real Continue button, popup, AuthClient and afterSignIn run end to end.
// The web SDK's popup helper still loads gapi from apis.google.com, so a slow network can stall one
// run: these tests get a longer budget and one retry (recorded in the build log).
test.describe.configure({ retries: 1, timeout: 120_000 });

test("Continue with Google signs a new adult in and goes to onboarding", async ({ page }) => {
  await page.goto("/sign-in");
  await signInWithButton(page, "Kavya Iyer");
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hi Kavya!/);
});

test("a pending join code is used right after sign-in, then onboarding runs", async ({ page, browser }) => {
  const admin = await browser.newPage();
  const code = await family(admin);
  await page.goto(`/join/${code}`);
  await signInWithButton(page, "Rahul Sharma", "Sign in with Google to join");
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  await admin.goto("/today");
  await expect(admin.getByText("Rahul joined via your code")).toBeVisible();
});

test("on a phone the redirect keeps the code across the round trip (sessionStorage)", async ({ browser }) => {
  const admin = await browser.newPage();
  const code = await family(admin, "Meera");
  const phone = await (await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE_URL })).newPage();
  await phone.goto(`/join/${code}`);
  await signInWithRedirect(phone, "Arjun", "Sign in with Google to join");
  await expect(phone).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
  await admin.goto("/today");
  await expect(admin.getByText("Arjun joined via your code")).toBeVisible();
});
