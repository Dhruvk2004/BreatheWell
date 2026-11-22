import { describe, expect, it, vi } from "vitest";
import { askForPlan, BADGE_TIMEOUT_MS } from "@/client/plan";

/** The client side of `POST /api/plan` (spec 7.2): ask, wait out another member's lock, give up after 30 s. */
const reply = (...bodies: object[]) => {
  const queue = [...bodies];
  return vi.fn(async () => new Response(JSON.stringify(queue.shift()), { status: 200 }));
};

function clock() {
  let now = 0;
  return { now: () => now, sleep: vi.fn(async (ms: number) => void (now += ms)) };
}

describe("askForPlan", () => {
  it("is ready or simple from the server's answer, and sends the retry flag", async () => {
    const fetcher = reply({ state: "ready" });
    expect(await askForPlan(true, fetcher, clock())).toBe("ready");
    expect(fetcher).toHaveBeenCalledWith("/api/plan", expect.objectContaining({ method: "POST", body: JSON.stringify({ retry: true }) }));
    expect(await askForPlan(false, reply({ state: "template" }), clock())).toBe("simple");
    expect(await askForPlan(false, reply({ state: "capped" }), clock())).toBe("simple");
  });

  it("waits while another member generates, at most 10 s at a time", async () => {
    const c = clock();
    expect(await askForPlan(false, reply({ state: "busy", retryAfterMs: 30_000 }, { state: "busy" }, { state: "ready" }), c)).toBe("ready");
    expect(c.sleep.mock.calls).toEqual([[10_000], [10_000]]);
  });

  it("gives up after the badge's 30 s and on any error", async () => {
    const busy = vi.fn(async () => new Response(JSON.stringify({ state: "busy", retryAfterMs: 9_000 }), { status: 200 }));
    const c = clock();
    expect(await askForPlan(false, busy, c)).toBe("simple");
    expect(c.now()).toBeLessThanOrEqual(BADGE_TIMEOUT_MS);
    expect(
      await askForPlan(
        false,
        vi.fn(async () => new Response("{}", { status: 500 })),
        clock(),
      ),
    ).toBe("simple");
    expect(
      await askForPlan(
        false,
        vi.fn(async () => Promise.reject(new Error("offline"))),
        clock(),
      ),
    ).toBe("simple");
  });
});
