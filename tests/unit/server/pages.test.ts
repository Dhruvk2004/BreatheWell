import { generateKeyPairSync } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
import { webManifest } from "@/config/manifest";
import { adminCredential, adminFirestore } from "@/firebase/admin";
import { loadAirNowPage } from "@/server/air/airNowPage";
import { airNowCommunity } from "@/server/air/community";
import { airDeps, airLimiter, storeFromEnv } from "@/server/air/runtime";
import { cacheDocId, toCacheDoc } from "@/server/air/snapshot";
import { firestoreAirStore } from "@/server/air/store";
import { airGet } from "@/server/handlers/air";
import { RateLimiter } from "@/server/rateLimit";
import { deps, NOW, snapshot } from "../../helpers/airDeps";

const request = (query: string, ip = "198.51.100.7") =>
  new Request(`https://app.test/api/air?${query}`, { headers: { "x-forwarded-for": ip } });

describe("GET /api/air (spec 11.2)", () => {
  it("returns the grid cell's snapshot with a CDN cache header", async () => {
    const response = await airGet(request("lat=28.56&lon=77.21"), deps(), new RateLimiter(60, 3_600_000));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=600");
    const body = (await response.json()) as { gridId: string; fetchedAt: string };
    expect(body).toMatchObject({ gridId: "28.6_77.2", fetchedAt: NOW.toISOString() });
  });

  it("refuses a bad query, limits per IP and says when there is no data", async () => {
    expect((await airGet(request("lat=abc"), deps(), new RateLimiter(60, 1))).status).toBe(400);
    const limiter = new RateLimiter(1, 3_600_000);
    await airGet(request("lat=1&lon=1"), deps(), limiter);
    const limited = await airGet(request("lat=1&lon=1"), deps(), limiter);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("3600");
    const down = deps({ fetchAir: vi.fn(async () => ({ ok: false as const, error: "timeout" as const })) });
    const none = await airGet(request("lat=1&lon=1"), down, new RateLimiter(60, 1));
    expect(none.status).toBe(503);
    expect(await none.json()).toEqual({
      error: { code: "air_unavailable", message: "We can't get the air data right now. We won't guess." },
    });
  });
});

describe("Air now page loader", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.5" });
  it("covers no place, rate limited, unavailable and ready", async () => {
    expect(await loadAirNowPage({}, headers, deps(), new RateLimiter(5, 1000), "en")).toEqual({ kind: "no_place" });
    const one = new RateLimiter(1, 1000);
    await loadAirNowPage({ lat: "1", lon: "1" }, headers, deps(), one, "en");
    expect(await loadAirNowPage({ lat: "1", lon: "1" }, headers, deps(), one, "en")).toEqual({ kind: "rate_limited" });
    const down = deps({ fetchAir: vi.fn(async () => ({ ok: false as const, error: "http" as const })) });
    expect(await loadAirNowPage({ lat: "28.56", lon: "77.21" }, headers, down, new RateLimiter(5, 1000), "en")).toMatchObject({
      kind: "unavailable",
      place: { name: null },
    });
    const ready = await loadAirNowPage(
      { lat: "28.56", lon: "77.21", place: "Green Park", cc: "IN" },
      headers,
      deps(),
      new RateLimiter(5, 1000),
      "en",
    );
    if (ready.kind !== "ready") throw new Error(ready.kind);
    expect(ready.place.name).toBe("Green Park");
    expect(ready.model.stationNote).toBe(true);
    expect(ready.timeZone).toBe("Asia/Kolkata");
  });
});

describe("Firestore air store", () => {
  it("writes the cache doc by id and reads it back with Timestamps turned into Dates", async () => {
    const docs = new Map<string, Record<string, unknown>>();
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({ data: () => docs.get(`${name}/${id}`) }),
          set: async (data: Record<string, unknown>) => void docs.set(`${name}/${id}`, data),
        }),
      }),
    };
    const store = firestoreAirStore(db as never);
    await store.put(snapshot());
    const id = `airCache/${cacheDocId("28.6_77.2", NOW)}`;
    expect(docs.has(id)).toBe(true);
    const stored = toCacheDoc(snapshot());
    docs.set(id, { ...stored, fetchedAt: Timestamp.fromDate(stored.fetchedAt), expireAt: Timestamp.fromDate(stored.expireAt) });
    expect(await store.get("28.6_77.2", NOW)).toEqual(snapshot());
    expect(await store.get("0.0_0.0", NOW)).toBeNull();
  });
});

describe("Firebase Admin set-up (never echoes a key)", () => {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");
  it("reads a base64 service account, else ADC, else nothing", () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    expect(
      adminCredential({ FIREBASE_SERVICE_ACCOUNT_B64: b64({ client_email: "a@b.iam", private_key: privateKey, project_id: "p" }) }),
    ).not.toBeNull();
    const noProject = b64({ client_email: "a@b.iam", private_key: privateKey });
    expect(adminCredential({ FIREBASE_SERVICE_ACCOUNT_B64: noProject, FIREBASE_PROJECT_ID: "p" })).not.toBeNull();
    expect(() => adminCredential({ FIREBASE_SERVICE_ACCOUNT_B64: noProject })).toThrow(/no project_id/);
    expect(adminCredential({ GOOGLE_APPLICATION_CREDENTIALS: "/key.json" })).not.toBeNull();
    expect(adminCredential({})).toBeNull();
  });

  it("refuses a broken key without showing it", () => {
    expect(() => adminCredential({ FIREBASE_SERVICE_ACCOUNT_B64: "not-json!" })).toThrow(/not a base64 service-account JSON key$/);
    expect(() => adminCredential({ FIREBASE_SERVICE_ACCOUNT_B64: b64({ client_email: "x" }) })).toThrow(/missing client_email/);
  });

  it("returns no Firestore without a project or a credential, and one for the emulator", () => {
    expect(adminFirestore({})).toBeNull();
    expect(adminFirestore({ FIREBASE_PROJECT_ID: "demo-x" })).toBeNull();
    const db = adminFirestore({ FIREBASE_PROJECT_ID: "demo-breathewell", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" });
    expect(db).not.toBeNull();
    expect(adminFirestore({})).toBe(db);
  });
});

describe("runtime and manifest", () => {
  it("creates the live dependencies once, without Firestore when nothing is configured", () => {
    const first = airDeps();
    expect(airDeps()).toBe(first);
    expect(first.now()).toBeInstanceOf(Date);
    expect(airLimiter.check("unit-test").allowed).toBe(true);
  });

  it("makes BreatheWell installable (F24)", () => {
    const m = webManifest();
    expect(m).toMatchObject({ name: "BreatheWell", start_url: "/", display: "standalone", theme_color: "#0B5E7A" });
    expect(m.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  });
});

describe("Air now wiring", () => {
  it("builds no community message without a 24-hour average", async () => {
    const page = await loadAirNowPage({ lat: "28.56", lon: "77.21" }, new Headers(), deps(), new RateLimiter(5, 1000), "hi");
    if (page.kind !== "ready") throw new Error(page.kind);
    expect(page.place.label).toBe("लगभग 28.56, 77.21 के आस-पास की जगह");
    const noAvg = { ...page.model, summary: { ...page.model.summary, avg24: null } };
    expect(airNowCommunity(noAvg, { place: "x", fetchedAt: NOW, timeZone: "Asia/Kolkata" }, "en")).toBeNull();
  });

  it("the live deps call Open-Meteo for the grid cell", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const live = airDeps();
    expect(await live.fetchAir({ lat: 28.6, lon: 77.2 })).toMatchObject({ ok: false });
    expect(await live.fetchWeather({ lat: 28.6, lon: 77.2 })).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("carries on without the Firestore cache when the Admin credential is broken", () => {
    // The real failure: a FIREBASE_SERVICE_ACCOUNT_B64 that is not a key throws inside the Admin setup.
    const broken = () => {
      adminCredential({ FIREBASE_SERVICE_ACCOUNT_B64: "bm90IGpzb24=" });
      return null;
    };
    expect(() => broken()).toThrow(/not a base64 service-account JSON key/);
    expect(storeFromEnv(broken)).toBeNull();
    expect(storeFromEnv(() => null)).toBeNull();
    expect(storeFromEnv(() => ({ collection: vi.fn() }) as unknown as ReturnType<typeof adminFirestore>)).not.toBeNull();
  });
});
