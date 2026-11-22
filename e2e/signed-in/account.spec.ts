import { expect, test } from "@playwright/test";
import { authUserExists, countWhere, noViolations, signIn, uniqueName } from "./auth";
import { addChild, family, joinWith, onboarded } from "./flows";

// Review fix (spec 11.4): ticks, profile and family edits, leave, delete account, the 60+ Hindi
// quick path, and a dependent's documents really gone after delete.

test("a plan tick is saved and still there after a reload", async ({ page }) => {
  await family(page);
  await page.goto("/today");
  await page.getByRole("link", { name: "Neha's plan" }).click();
  const tick = page.getByRole("checkbox", { name: "Office or work trip: done" });
  const [saved] = await Promise.all([page.waitForResponse("**/api/progress"), tick.check()]);
  expect(saved.status(), await saved.text()).toBe(200);
  await expect(tick).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Office or work trip: done" })).toBeChecked();
  await noViolations(page);
});

test("the admin renames the family; a member edits the profile, then leaves", async ({ page, browser }) => {
  const code = await family(page);
  await page.goto("/family/settings");
  await page.getByRole("textbox", { name: "Family name" }).fill("Sharma ghar");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByText("Saved.").first()).toBeVisible();
  const rahul = await browser.newPage();
  await onboarded(rahul, "Rahul");
  await joinWith(rahul, code);
  await rahul.goto("/profile");
  await rahul.getByRole("checkbox", { name: "Asthma" }).check();
  await rahul.getByRole("button", { name: "Save changes" }).click();
  await expect(rahul.getByText("Saved.").first()).toBeVisible();
  await rahul.reload();
  await expect(rahul.getByRole("checkbox", { name: "Asthma" })).toBeChecked();
  await expect(rahul.getByText("Sharma ghar · Member")).toBeVisible();
  await rahul.getByRole("button", { name: "Leave family" }).click();
  await rahul.getByRole("dialog").getByRole("button", { name: "Leave" }).click();
  await expect(rahul).toHaveURL(/\/onboarding$/);
});

test("delete my account removes the Auth user and the profile", async ({ page }) => {
  const name = uniqueName("Asha");
  const user = await onboarded(page, name);
  const email = `${user.uid}@example.com`;
  expect([await countWhere("users", "name", name), await authUserExists(email)]).toEqual([1, true]);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect([await countWhere("users", "name", name), await authUserExists(email)]).toEqual([0, false]);
});

test("60+ in Hindi takes the quick path with Large text", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "bw-lang", value: "hi", url: baseURL }]);
  await signIn(page, "Ramesh");
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "आगे" }).click();
  await page.getByRole("button", { name: "आगे" }).click();
  await page.getByRole("radio", { name: /60 या उससे ज़्यादा/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-text", "lg");
  await page.getByRole("button", { name: "आगे" }).click();
  await expect(page.getByText("3 में से 1")).toBeVisible();
  await noViolations(page);
  await page.getByRole("button", { name: "आगे" }).click();
  await page.getByRole("button", { name: "आगे" }).click();
  await page.getByRole("radio", { name: "मेट्रो" }).check();
  await page.getByRole("button", { name: "हो गया" }).click();
  await expect(page).toHaveURL(/\/family\/new$/);
});

test("deleting a child erases her document, not just the link", async ({ page }) => {
  await family(page);
  const name = uniqueName("Tara");
  const { id } = await addChild(page, name);
  expect(await countWhere("dependents", "name", name)).toBe(1);
  await page.goto(`/dependent/${id}`);
  await expect(page.locator("h1")).toBeVisible();
  await noViolations(page);
  await page.getByRole("button", { name: `Delete ${name}'s profile` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/today$/);
  expect(await countWhere("dependents", "name", name)).toBe(0);
});
