import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Signs a page in through the real path (as in Utsav): the Auth emulator issues a Google ID token,
 * the browser posts it with the 18+ tick to `POST /api/session`, and the server mints the httpOnly
 * cookie with the Admin SDK. No test-only route exists.
 */
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:3481";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:3480";
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3110";

/** The origin of this test's app server (the "plan" project runs its own, with the Gemini stand-in). */
export const appOrigin = (): string => (test.info().project.use.baseURL as string | undefined) ?? BASE_URL;

let counter = 0;

/** A unique Google identity per test, so tests never share Firestore state. */
export function newUser(name: string): { uid: string; name: string } {
  counter += 1;
  return { uid: `google-${Date.now().toString(36)}${process.pid.toString(36)}${counter}`, name };
}

/** Sign-in is limited per client IP; `next start` sees the rightmost X-Forwarded-For hop as the client. */
const clientAddress = () => `198.51.100.${(process.pid + counter) % 250}`;

async function emulatorIdToken(user: { uid: string; name: string }): Promise<string> {
  const claims = JSON.stringify({ sub: user.uid, email: `${user.uid}@example.com`, email_verified: true, name: user.name });
  const response = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(claims)}&providerId=google.com`,
      requestUri: "http://localhost",
      returnSecureToken: true,
    }),
  });
  expect(response.ok, await response.clone().text()).toBe(true);
  return ((await response.json()) as { idToken: string }).idToken;
}

/** Signs in (the 18+ tick sent, as the sign-in screen does) and returns the user. */
export async function signIn(page: Page, name: string) {
  const user = newUser(name);
  const idToken = await emulatorIdToken(user);
  const response = await page.request.post("/api/session", {
    data: { idToken, adultConfirmed: true },
    headers: { origin: appOrigin(), "x-forwarded-for": clientAddress() },
  });
  expect(response.status(), await response.text()).toBe(200);
  return user;
}

export const noViolations = async (page: Page) => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

export const PUNE = {
  results: [{ id: 1, name: "Green Park", latitude: 28.5594, longitude: 77.2066, country: "India", country_code: "IN", admin1: "Delhi" }],
};

/**
 * Signs in through the real button (review fix, spec 10.4): the 18+ tick, Continue, the web SDK's
 * popup on the Auth emulator's Google page (`authEmulatorHost`), then `AuthClient` and `afterSignIn`.
 */
export async function signInWithButton(page: Page, name: string, button = "Continue with Google") {
  const user = newUser(name);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": clientAddress() });
  await page.getByRole("checkbox", { name: /I am 18 or older/ }).check();
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: button }).click()]);
  await popup.waitForLoadState();
  await popup.getByRole("button", { name: /Add new account/i }).click();
  await popup.getByLabel(/Email/i).fill(`${user.uid}@example.com`);
  await popup.getByLabel(/Display name/i).fill(name);
  await Promise.all([popup.waitForEvent("close"), popup.getByRole("button", { name: /Sign in with Google/i }).click()]);
  return user;
}

/** How many documents of a collection group (`dependents`, `items`…) have this field value. */
export async function countWhere(collectionId: string, field: string, value: string): Promise<number> {
  const response = await fetch(`http://${FIRESTORE_HOST}/v1/projects/demo-breathewell/databases/(default)/documents:runQuery`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId, allDescendants: true }],
        where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } },
      },
    }),
  });
  const rows = (await response.json()) as { document?: unknown }[];
  return rows.filter((row) => row.document).length;
}

/** Whether the Auth emulator still holds an account for this email. */
export async function authUserExists(email: string): Promise<boolean> {
  const response = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/demo-breathewell/accounts:lookup`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ email: [email] }),
  });
  return (((await response.json()) as { users?: unknown[] }).users?.length ?? 0) > 0;
}

/** A name no other test uses (letters only, as names allow). */
export const uniqueName = (base: string): string =>
  base + Array.from({ length: 5 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

/** Signs in on a phone: the web SDK's redirect to the emulator's Google page and back (sessionStorage path). */
export async function signInWithRedirect(page: Page, name: string, button: string) {
  const user = newUser(name);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": clientAddress() });
  await page.getByRole("checkbox", { name: /I am 18 or older/ }).check();
  await page.getByRole("button", { name: button }).click();
  await page.waitForURL(/\/emulator\/auth\//, { timeout: 20_000 });
  await page.getByRole("button", { name: /Add new account/i }).click({ timeout: 15_000 });
  await page.getByLabel(/Email/i).fill(`${user.uid}@example.com`);
  await page.getByLabel(/Display name/i).fill(name);
  await page.getByRole("button", { name: /Sign in with Google/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/emulator/"), { timeout: 20_000 });
  return user;
}
