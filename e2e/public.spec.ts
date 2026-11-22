import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FALLBACK_PORT } from "../playwright.config";

/** Slice 2: the public pages work with no keys, pass axe in EN, HI and large text, and the demo tells the smog story. */

const noViolations = async (page: Page) => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

const withText = async (page: Page, baseURL: string | undefined, lang: "en" | "hi", text: "lg" | "xl") => {
  await page.context().addCookies([
    { name: "bw-lang", value: lang, url: baseURL },
    { name: "bw-text", value: text, url: baseURL },
  ]);
};

const PUNE = {
  results: [
    { id: 1259229, name: "Pune", latitude: 18.51957, longitude: 73.85535, country: "India", country_code: "IN", admin1: "Maharashtra" },
  ],
};

test("location denied → city search → Air now for Pune", async ({ page }) => {
  await page.route("https://geocoding-api.open-meteo.com/**", (route) => route.fulfill({ json: PUNE }));
  await page.goto("/");
  await page.getByRole("button", { name: "Check the air near me" }).click();
  await expect(page.getByText("We'll use the city you pick. You can change it any time.")).toBeVisible();
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.getByRole("combobox").fill("Pun");
  await page.getByRole("option", { name: /Pune, Maharashtra, India/ }).click();
  await expect(page).toHaveURL(/\/air\?place=Pune.*&lat=18\.52&lon=73\.86&cc=IN/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Air now in Pune/);
  // The server's Open-Meteo calls go to the local stand-in (playwright.config.ts), so the data is always there.
  await expect(page.getByRole("group", { name: /^Air quality now/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Next 5 days" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "At home today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "One swap for the air today" })).toBeVisible();
  await expect(page.getByText(/Simple message/)).toBeVisible();
  await expect(page.getByText(/Official stations may read higher/)).toHaveCount(0);
  await noViolations(page);
});

for (const [hour, label] of [
  ["06:00", "6 am"],
  ["16:00", "4 pm"],
  ["22:30", "10:30 pm"],
] as const) {
  test(`demo Smog morning: Avoid and a mode switch, the same with the browser clock at ${label}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(`2026-11-22T${hour}:00+05:30`));
    await page.goto("/demo");
    await expect(page.getByText("Sample family. Sign in to make your own.")).toBeVisible();
    await expect(page.getByText(/Recorded sample day · shown as at 6:10 am/)).toBeVisible();
    await expect(page.getByText("Avoid", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Take the school bus at 7 am, not the cycle.")).toBeVisible();
    await expect(page.getByText(/Best time outside today: 3–5 pm/)).toBeVisible();
  });
}

test("the time stepper moves the scenario clock; the Severe day shows the GRAP note", async ({ page }) => {
  // The band colour fades over 320 ms when the reading changes (design F); axe checks the settled colours.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo");
  await page.getByRole("link", { name: "4 pm" }).click();
  await expect(page).toHaveURL(/time=16/);
  await expect(page.getByText(/Best time left today: 4–6 pm/)).toBeVisible();
  await expect(page.getByText("Walk in the hall today, not at 6:30 am.")).toBeVisible();
  await page.getByRole("link", { name: "Severe day" }).click();
  await expect(page).toHaveURL(/scenario=severe-day&time=16/);
  await page.getByRole("link", { name: "6 am" }).click();
  await expect(page).toHaveURL(/scenario=severe-day&time=6/);
  await expect(page.getByText(/GRAP rules apply/)).toBeVisible();
  await noViolations(page);
});

test("the 12 pm step shows the scenario clock at 12:10 pm and the rest of the day's window", async ({ page }) => {
  await page.goto("/demo?scenario=smog-morning&time=12");
  await expect(page.getByRole("link", { name: "12 pm" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByText(/Recorded sample day · shown as at 12:10 pm/)).toBeVisible();
  await expect(page.getByText(/Best time left today:/)).toBeVisible();
});

test("Live today plans with live air: no stepper, the station note and the rules-only line", async ({ page }) => {
  await page.goto("/demo?scenario=live");
  await expect(page.getByText(/^Live air, /)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Time of day" })).toHaveCount(0);
  await expect(page.getByText(/Official stations may read higher/)).toBeVisible();
  await expect(page.getByText(/not the AI assistant/)).toBeVisible();
  await expect(page.getByText(/^Simple plan · Updated air/)).toBeVisible();
  await noViolations(page);
});

test("Live today falls back to the saved 20 Nov reading when Open-Meteo fails", async ({ page }) => {
  await page.goto(`http://localhost:${FALLBACK_PORT}/demo?scenario=live`);
  await expect(page.getByText(/Showing the saved reading from 20 Nov 2026/)).toBeVisible();
  await expect(
    page
      .getByText("Avoid", { exact: true })
      .or(page.getByText("Go with care", { exact: true }))
      .first(),
  ).toBeVisible();
});

test("Dadaji's view is a large Hindi card; Riya's kid card has no numbers but times 🔒", async ({ page }) => {
  await page.goto("/demo?view=dadaji");
  await expect(page.getByText("What Dadaji sees: Hindi, extra large text.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "नमस्ते, दादाजी" })).toBeVisible();
  await expect(page.locator(".text-scope-xl")).toHaveAttribute("lang", "hi");
  await noViolations(page);
  await page.goto("/demo");
  await page.getByRole("link", { name: "Kid card: Riya" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Riya's air card" })).toBeVisible();
  const card = (await page.locator("article").innerText()).replace(/\b\d{1,2}(:\d{2})? ?(am|pm)\b/g, "");
  expect(card).not.toMatch(/\d/);
  expect(card).not.toMatch(/cigarette|µg|AQI/i);
  await page.getByRole("button", { name: "Show full screen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Show full screen" })).toBeFocused();
  await noViolations(page);
});

for (const path of [
  "/",
  "/air?place=Green%20Park%2C%20New%20Delhi&lat=28.56&lon=77.21&cc=IN",
  "/demo",
  "/demo/kid/aarav",
  "/demo/ask",
  "/community?place=Green%20Park%2C%20New%20Delhi&lat=28.56&lon=77.21",
  "/learn",
  "/privacy",
  "/nowhere",
]) {
  // Large text at 150 % (xl, in Hindi) and 125 % (lg, in English) on every public page (spec 11.5).
  for (const [lang, text] of [
    ["hi", "xl"],
    ["en", "lg"],
  ] as const) {
    test(`${path} has no axe violations or sideways scroll (${lang}, ${text})`, async ({ page, baseURL }) => {
      await withText(page, baseURL, lang, text);
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await noViolations(page);
    });
  }
}

test("Learn and Privacy pass axe in English; the manifest makes the app installable", async ({ page, request }) => {
  for (const path of ["/learn", "/privacy"]) {
    await page.goto(path);
    await noViolations(page);
  }
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "BreatheWell", display: "standalone" });
  expect((await request.get("/icons/icon-512.png")).status()).toBe(200);
});

test("Breezy demo: chips only, an answer with its label, a card that writes nothing", async ({ page }) => {
  await page.goto("/demo/ask");
  await expect(page.getByLabel("Your question for Breezy")).toHaveCount(0);
  await page.getByRole("button", { name: "Plan Dadaji's temple visit" }).click();
  await expect(page.getByText(/^The best time for Dadaji's temple visit is/)).toBeVisible();
  await expect(page.getByText("Simple answer · from the safety rules")).toBeVisible();
  await expect(page.getByText("In your own family this would add to Dadaji's plan.")).toBeVisible();
  await noViolations(page);
});

test("Community: both languages, copy buttons, the Simple message label without a key", async ({ page }) => {
  await page.goto("/community?place=Green%20Park%2C%20New%20Delhi&lat=28.56&lon=77.21");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today's message for Green Park, New Delhi");
  await expect(page.getByRole("region", { name: "Hindi" })).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("button", { name: "Copy both" })).toBeVisible();
  await expect(page.getByText(/^Simple message/)).toBeVisible();
  await noViolations(page);
});
