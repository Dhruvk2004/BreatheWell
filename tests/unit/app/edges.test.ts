import { describe, expect, it, vi } from "vitest";
import { initialsOf } from "@/domain/family/caps";
import { progressTotals } from "@/domain/impact/progress";
import { loadOnboarding, loadProfile } from "@/server/app/accountPages";
import type { SignedIn } from "@/server/app/guards";
import { planFamilyToday, plannedPeople } from "@/server/app/familyPlan";
import { airView, familyView } from "@/server/app/familyView";
import { loadViewer } from "@/server/app/viewer";
import { dbOf } from "@/server/deps";
import { MAX_BODY_BYTES, readJson } from "@/server/http";
import { createAppDeps, jsonLog } from "@/server/runtime";
import { z } from "zod";
import { deps as airDeps, NOW } from "../../helpers/airDeps";
import { testApp } from "../../helpers/appDeps";
import { sharmaFamily } from "../../helpers/family";

describe("small server pieces", () => {
  it("reads only JSON bodies of a sane size", async () => {
    const post = (body: string, type = "application/json") =>
      new Request("https://app.test/x", { method: "POST", headers: { "content-type": type }, body });
    expect((await readJson(post("{}", "text/plain"), z.object({}))).ok).toBe(false);
    const big = await readJson(post(`"${"x".repeat(MAX_BODY_BYTES)}"`), z.string());
    expect(big.ok || big.response.status).toBe(413);
    const broken = await readJson(post("{"), z.object({}));
    expect(broken.ok || broken.response.status).toBe(400);
    const wrong = await readJson(post("[]"), z.object({ a: z.string() }));
    expect(wrong.ok || (await wrong.response.json())).toMatchObject({ error: { fields: { form: expect.any(String) } } });
  });

  it("builds production deps from the environment without Firebase, and logs uids hashed", () => {
    const deps = createAppDeps({ APP_ORIGIN: "https://breathewell.app/" });
    expect([deps.db, deps.auth, deps.sessions, deps.appOrigin]).toEqual([null, null, null, "https://breathewell.app"]);
    expect(deps.randomBytes(4)).toHaveLength(4);
    expect(deps.now()).toBeInstanceOf(Date);
    expect(createAppDeps({ FIREBASE_SERVICE_ACCOUNT_B64: "not base64 json", FIREBASE_PROJECT_ID: "p" }).db).toBeNull();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    jsonLog("member_joined", { uid: "neha", n: 1 });
    jsonLog("plain");
    const line = JSON.parse(String(log.mock.calls[0][0]));
    expect(line).toMatchObject({ message: "member_joined", n: 1, uidHash: expect.stringMatching(/^[0-9a-f]{16}$/) });
    expect(JSON.stringify(line)).not.toContain("neha");
    expect(() => dbOf({ db: null })).toThrow("not configured");
    return deps.pause(0);
  });

  it("makes initials from letters only and totals protected time and CO₂", () => {
    expect(initialsOf("7 Rahul")).toBe("R");
    expect(initialsOf("Neha  Rani Sharma")).toBe("NS");
    const activity = { id: "o", type: "office_trip" as const, usual: "08:30", flex: "fixed" as const, duration: "15to60" as const };
    const plan = { suggestion: "switch_mode", switchTo: "metro" } as never;
    const asPlanned = { suggestion: "as_planned", switchTo: null } as never;
    const totals = progressTotals(
      [
        { activity, plan },
        { activity, plan: asPlanned },
      ],
      { main: "two_wheeler", tripLength: "15to45" },
    );
    expect(totals.protectedHours).toBeGreaterThan(0);
    expect(totals.co2AvoidedKg).toBeGreaterThan(0);
  });
});

describe("family plan edges", () => {
  it("plans with careful home defaults, skips the station note outside India and has no day without air", async () => {
    const app = testApp();
    const { fid } = await sharmaFamily(app);
    app.db.docs.delete(`families/${fid}/private/home`);
    const viewer = (await loadViewer("session:neha", app.deps)) as SignedIn & { bundle: NonNullable<SignedIn["bundle"]> };
    expect(viewer.bundle.homeSetup).toBeNull();
    const planned = await planFamilyToday(viewer.bundle, "neha", app.deps.air);
    expect(planned.stationNote).toBe(true);
    expect(planned.day?.homeTips.length).toBeGreaterThan(0);
    const abroad = {
      ...viewer.bundle,
      family: { ...viewer.bundle.family, home: { ...viewer.bundle.family.home, lat2: 51.5, lon2: -0.12, countryCode: "GB" } },
    };
    expect((await planFamilyToday(abroad, "neha", app.deps.air)).stationNote).toBe(false);
    const down = await planFamilyToday(
      viewer.bundle,
      "neha",
      airDeps({ fetchAir: async () => ({ ok: false as const, error: "timeout" as const }) }),
    );
    expect([down.day, down.snapshot]).toEqual([null, null]);
    expect(airView(down, NOW)).toMatchObject({ day: null, fetchedAt: null, timeZone: "Asia/Kolkata", setupVerdict: null });
    expect(plannedPeople(viewer.bundle).map((p) => p.id)).toEqual(["neha"]);
    const orphan = {
      ...viewer.bundle,
      dependents: [
        {
          id: "d9",
          record: {
            name: "Kid",
            ageGroup: "13to17",
            careTag: "none",
            travel: { main: "walk" },
            cardLanguage: "en",
            guardianUid: "gone",
          },
        },
      ],
    };
    expect(familyView(orphan as never, "neha").people[1]).toMatchObject({ guardianName: null, initials: "K" });
  });

  it("onboarding and profile fall back when the health doc is missing; a removed viewer sees the family name", async () => {
    const app = testApp();
    await sharmaFamily(app);
    app.db.docs.delete("users/neha/private/health");
    const neha = (await loadViewer("session:neha", app.deps)) as SignedIn;
    expect((await loadProfile(neha, app.deps))?.input).toMatchObject({ conditions: [], shareWith: "self" });
    app.db.docs.set("users/neha", { ...app.db.docs.get("users/neha"), familyId: null, removedFrom: "Sharma family" });
    const removed = (await loadViewer("session:neha", app.deps)) as SignedIn;
    expect(await loadOnboarding(removed, app.deps)).toMatchObject({ hasFamily: false, familyName: null, removedFrom: "Sharma family" });
  });
});

describe("timestamps and the shared deps", () => {
  it("converts timestamp fields by name at any depth, and back", async () => {
    const { decodeTimestamps, encodeTimestamps } = await import("@/server/db/timestamps");
    class Stamp {
      constructor(readonly iso: string) {}
    }
    const codec = {
      fromIso: (iso: string) => new Stamp(iso),
      isTimestamp: (v: unknown): v is Stamp => v instanceof Stamp,
      toIso: (v: Stamp) => v.iso,
    };
    const doc = {
      name: "2024-11-18T00:40:00.000Z",
      joinedVia: { at: "2024-11-18T00:40:00.000Z" },
      list: [{ doneAt: "x" }],
      gone: undefined,
    };
    const encoded = encodeTimestamps(doc, codec) as Record<string, unknown>;
    expect(encoded).toEqual({
      name: "2024-11-18T00:40:00.000Z",
      joinedVia: { at: new Stamp("2024-11-18T00:40:00.000Z") },
      list: [{ doneAt: new Stamp("x") }],
    });
    expect(decodeTimestamps(encoded, codec)).toEqual({
      name: "2024-11-18T00:40:00.000Z",
      joinedVia: { at: "2024-11-18T00:40:00.000Z" },
      list: [{ doneAt: "x" }],
    });
  });

  it("keeps one deps object per server process", async () => {
    const { appDeps } = await import("@/server/runtime");
    expect(appDeps()).toBe(appDeps());
  });
});
