import { describe, expect, it, vi } from "vitest";
import { cronSecret } from "@/config/env";
import { cleanupDeps } from "@/server/cleanup/runtime";
import { EXPIRING_GROUPS, sweepExpired, type ExpiredSweeper, type ExpiringGroup } from "@/server/cleanup/sweep";
import { authorised, cleanupGet, type CleanupDeps } from "@/server/handlers/cleanup";

const NOW = new Date("2026-11-22T21:30:00.000Z");
const BUDGET = { batch: 2, maxDeletes: 100, maxMs: 40_000 };

/** A sweeper over fixed counts of expired docs per group, recording every call. */
function fakeSweeper(expired: Partial<Record<ExpiringGroup, number>>) {
  const left = { ...expired };
  const calls: { group: ExpiringGroup; before: Date; limit: number }[] = [];
  const sweeper: ExpiredSweeper = {
    deleteExpired: async (group, before, limit) => {
      calls.push({ group, before, limit });
      const n = Math.min(limit, left[group] ?? 0);
      left[group] = (left[group] ?? 0) - n;
      return n;
    },
  };
  return { sweeper, calls, left };
}

describe("sweepExpired", () => {
  it("empties every group in batches and reports per-group counts", async () => {
    const { sweeper, calls, left } = fakeSweeper({ airCache: 5, plans: 2, members: 1 });
    const result = await sweepExpired(sweeper, () => NOW, BUDGET);
    expect(result).toEqual({ deleted: { airCache: 5, plans: 2, members: 1 }, total: 8, complete: true });
    expect(Object.values(left).every((n) => n === 0)).toBe(true);
    expect(new Set(calls.map((c) => c.group))).toEqual(new Set(EXPIRING_GROUPS));
    expect(calls.every((c) => c.before === NOW && c.limit <= BUDGET.batch)).toBe(true);
  });

  it("stops at the delete budget and says the run is incomplete", async () => {
    const { sweeper, left } = fakeSweeper({ airCache: 3, joinCodes: 4 });
    const result = await sweepExpired(sweeper, () => NOW, { ...BUDGET, maxDeletes: 5 });
    expect(result.total).toBe(5);
    expect(result.complete).toBe(false);
    expect(left.joinCodes).toBe(2);
  });

  it("stops starting batches once the time budget is used up", async () => {
    const { sweeper, calls } = fakeSweeper({ airCache: 10 });
    let ms = NOW.getTime();
    const clock = () => new Date((ms += 15_000));
    const result = await sweepExpired(sweeper, clock, BUDGET);
    expect(result.complete).toBe(false);
    expect(calls.length).toBeLessThan(5);
  });

  it("does nothing and is complete when nothing has expired", async () => {
    const { sweeper } = fakeSweeper({});
    expect(await sweepExpired(sweeper, () => NOW, BUDGET)).toEqual({ deleted: {}, total: 0, complete: true });
  });

  it("uses the default budget when none is given", async () => {
    const { sweeper, calls } = fakeSweeper({ airCache: 1 });
    await sweepExpired(sweeper, () => NOW);
    expect(calls[0]?.limit).toBe(300);
  });
});

describe("cleanup route", () => {
  const request = (auth?: string) => new Request("https://app.test/api/cron/cleanup", auth ? { headers: { authorization: auth } } : {});
  const deps = (over: Partial<CleanupDeps> = {}): CleanupDeps => ({
    secret: "s3cret-value",
    sweeper: fakeSweeper({ items: 3 }).sweeper,
    clock: () => NOW,
    log: vi.fn(),
    budget: BUDGET,
    ...over,
  });

  it("refuses every call when CRON_SECRET is not set", async () => {
    const res = await cleanupGet(request("Bearer anything"), deps({ secret: null }));
    expect(res.status).toBe(503);
  });

  it.each([undefined, "Bearer wrong", "s3cret-value", "Bearer ", "Basic s3cret-value"])(
    "rejects authorization %s with 401",
    async (auth) => {
      const sweeper = fakeSweeper({ items: 3 });
      const res = await cleanupGet(request(auth), deps({ sweeper: sweeper.sweeper }));
      expect(res.status).toBe(401);
      expect(sweeper.calls).toHaveLength(0);
    },
  );

  it("returns 503 without a database", async () => {
    expect((await cleanupGet(request("Bearer s3cret-value"), deps({ sweeper: null }))).status).toBe(503);
  });

  it("sweeps, logs counts only, and is never cached", async () => {
    const log = vi.fn();
    const res = await cleanupGet(request("Bearer s3cret-value"), deps({ log }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({ deleted: { items: 3 }, total: 3, complete: true });
    expect(log).toHaveBeenCalledWith("cleanup_swept", { total: 3, complete: true, items: 3 });
  });

  it("compares tokens of any length safely", () => {
    expect(authorised("Bearer s3cret-value", "s3cret-value")).toBe(true);
    expect(authorised("Bearer s3cret-valuE", "s3cret-value")).toBe(false);
    expect(authorised(null, "s3cret-value")).toBe(false);
  });
});

describe("cleanup config", () => {
  it("reads CRON_SECRET, trimmed, or null", () => {
    expect(cronSecret({})).toBeNull();
    expect(cronSecret({ CRON_SECRET: "  abc  " })).toBe("abc");
  });

  it("builds deps with no database and no secret when nothing is set", () => {
    const d = cleanupDeps({});
    expect(d.secret).toBeNull();
    expect(d.sweeper).toBeNull();
    expect(d.clock()).toBeInstanceOf(Date);
  });

  it("leaves the sweeper off when the credential is broken", () => {
    const d = cleanupDeps({ FIREBASE_SERVICE_ACCOUNT_B64: "not-base64-json", CRON_SECRET: "x" });
    expect(d.sweeper).toBeNull();
    expect(d.secret).toBe("x");
  });

  it("builds a sweeper against an emulator project", () => {
    const d = cleanupDeps({ FIREBASE_PROJECT_ID: "demo-cleanup", FIRESTORE_EMULATOR_HOST: "127.0.0.1:1" });
    expect(d.sweeper).not.toBeNull();
  });
});
