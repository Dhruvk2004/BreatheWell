import { expect, test, type Page } from "@playwright/test";
import { noViolations, signIn } from "./auth";
import { family, joinWith, mockGeocoding, onboarded } from "./flows";

// E2E: create family → invite → a second adult joins → the admin's join card → a dependent
// and her kid card → still setting up → delete the dependent → remove the member → old codes.

const next = (page: Page) => page.getByRole("button", { name: "Next" }).click();

test("a new adult onboards, creates the family and sees the invite with its QR", async ({ page }) => {
  await signIn(page, "Neha Sharma");
  await mockGeocoding(page);
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hi Neha!/);
  await next(page);
  await next(page);
  await page.getByRole("radio", { name: "18–59" }).check();
  await next(page);
  await next(page);
  await page.getByRole("checkbox", { name: "Office or work trip" }).check();
  await next(page);
  await page.getByRole("radio", { name: "Two-wheeler" }).check();
  await next(page);
  await expect(page.getByRole("heading", { name: "Your plan is based on" })).toBeVisible();
  await noViolations(page);
  await page.getByRole("button", { name: "Looks good" }).click();
  await expect(page).toHaveURL(/\/family\/new$/);
  await page.getByRole("textbox", { name: "Family name" }).fill("Sharma family");
  await page.getByRole("combobox").fill("Green");
  await page.getByRole("option", { name: /Green Park/ }).click();
  await noViolations(page);
  await page.getByRole("button", { name: "Create family" }).click();
  await expect(page).toHaveURL(/\/family\/invite$/);
  await expect(page.getByText(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/).first()).toBeVisible();
  await expect(page.getByRole("img", { name: "QR code for the join link" }).first().locator("path")).toHaveAttribute("d", /^M/);
  await noViolations(page);
});

test("a second adult joins by link; the admin sees the join card and removes them", async ({ page, browser }) => {
  const code = await family(page);
  const rahul = await browser.newPage();
  await onboarded(rahul, "Rahul");
  await rahul.goto(`/join/${code}`);
  await rahul.getByRole("button", { name: "Join" }).click();
  await expect(rahul).toHaveURL(/\/today$/);
  await expect(rahul.getByRole("link", { name: "Rahul's plan" })).toBeVisible();
  await page.goto("/today");
  await expect(page.getByText("Rahul joined via your code")).toBeVisible();
  await expect(page.getByText(/^Best time/)).toBeVisible();
  await noViolations(page);
  await page.getByRole("button", { name: "Remove Rahul" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Rahul joined via your code")).toHaveCount(0);
  await rahul.goto("/onboarding");
  await expect(rahul.getByText(/You're no longer in Neha's family/)).toBeVisible();
});

test("a member who skips onboarding shows as still setting up", async ({ page, browser }) => {
  const code = await family(page);
  const dadaji = await browser.newPage();
  await signIn(dadaji, "Ramesh");
  await joinWith(dadaji, code);
  await page.goto("/today");
  await expect(page.getByText("Ramesh is still setting up")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remind Ramesh" })).toBeVisible();
});

test("an adult adds a child; the kid card has no numbers but clock times; delete erases her", async ({ page }) => {
  await family(page);
  await page.goto("/today");
  await page.getByRole("link", { name: "Add a child or teen" }).click();
  await page.getByRole("textbox", { name: "First name or nickname" }).fill("Riya");
  await page.getByRole("radio", { name: "Under 13" }).check();
  await page.getByRole("checkbox", { name: "School trip" }).check();
  await page.getByRole("radio", { name: "Cycle" }).check();
  await noViolations(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.getByRole("link", { name: "Kid card: Riya" }).click();
  const card = page.locator("article");
  await expect(card).toContainText("Riya's air card");
  const text = (await card.innerText()).replace(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/gi, "");
  expect(text).not.toMatch(/\d|cigarette|µg|AQI/i);
  const share = await page.getByText(/^Riya's air card for today/).innerText();
  expect(share.replace(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/gi, "")).not.toMatch(/\d/);
  await noViolations(page);
  await page.goto("/family/settings");
  await page.getByRole("button", { name: "Delete Riya's profile" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("link", { name: "Kid card: Riya" })).toHaveCount(0);
});

test("a replaced code stops working at once; a typed bad code says so", async ({ page, browser }) => {
  const code = await family(page);
  await page.goto("/family/invite");
  await page.getByRole("button", { name: "Make a new code" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Make code" }).click();
  const other = await browser.newPage();
  await onboarded(other, "Asha");
  await other.goto(`/join/${code}`);
  await expect(other.getByRole("alert").first()).toHaveText(/We couldn't find that code/);
  await other.getByLabel("Enter code").fill("ZZZZ-ZZZZ");
  await other.getByRole("button", { name: "Join" }).click();
  await expect(other.getByText("We couldn't find that code. Check it and try again.").last()).toBeVisible();
});
