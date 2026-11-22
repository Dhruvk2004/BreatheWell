import { expect, type Page } from "@playwright/test";
import { appOrigin, PUNE, signIn } from "./auth";

/** Shortcuts through the same JSON routes the pages use (each test signs in as its own user). */
const write = async (page: Page, method: "post" | "put", path: string, data: unknown) => {
  const response = await page.request[method](path, { data, headers: { origin: appOrigin() } });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
};

export const PROFILE = {
  language: "en",
  textSize: "md",
  ageGroup: "18to59",
  conditions: [],
  shareWith: "self",
  activities: [{ type: "office_trip", band: "morning", flex: "fixed", duration: "15to60" }],
  travel: { main: "two_wheeler", tripLength: "15to45", others: ["metro"] },
};

export async function onboarded(page: Page, name: string) {
  const user = await signIn(page, name);
  await write(page, "put", "/api/profile", { ...PROFILE, name });
  return user;
}

/** An onboarded admin with a family in Green Park; returns the join code. */
export async function family(page: Page, name = "Neha"): Promise<string> {
  await onboarded(page, name);
  const home = { name: "Green Park, New Delhi", lat: 28.5594, lon: 77.2066, countryCode: "IN" };
  const homeSetup = {
    purifier: "one_room",
    freshAirVent: false,
    roadFacing: "yes",
    fuel: "lpg",
    incense: "sometimes",
    indoorSmoking: "no",
  };
  const created = (await write(page, "post", "/api/family", { name: `${name}'s family`, home, homeSetup })) as { code: string };
  return created.code;
}

export const addChild = (page: Page, name: string) =>
  write(page, "post", "/api/dependent", {
    name,
    ageGroup: "under13",
    conditions: [],
    picks: [{ choice: "school_trip" }],
    travel: { main: "cycle", others: [] },
    cardLanguage: "en",
  }) as Promise<{ id: string }>;

export const joinWith = (page: Page, code: string) => write(page, "post", "/api/join", { code });

export const mockGeocoding = (page: Page) =>
  page.route("https://geocoding-api.open-meteo.com/**", (route) => route.fulfill({ json: PUNE }));
