import { describe, expect, it } from "vitest";
import { serverClock } from "@/server/clock";

/** 00:13 IST on 22 Nov 2026 is 18:43 UTC on the 21st; 15:20:30 IST is 09:50:30 UTC. */
const AT_0013 = new Date("2026-11-21T18:43:00Z");
const AT_1520 = new Date("2026-11-22T09:50:30Z");
const DEMO = { FIREBASE_PROJECT_ID: "demo-breathewell", E2E_IST_CLOCK: "10:00" };

const ticking = (start: Date) => {
  let t = start.getTime();
  return { real: () => new Date(t), advance: (ms: number) => (t += ms) };
};

describe("serverClock", () => {
  it("is the real clock without the E2E variable", () => {
    const real = () => AT_0013;
    expect(serverClock({ FIREBASE_PROJECT_ID: "demo-breathewell" }, real)).toBe(real);
  });

  it("ignores the E2E variable outside a demo-* project and when malformed", () => {
    const real = () => AT_0013;
    expect(serverClock({ FIREBASE_PROJECT_ID: "breathewell-prod", E2E_IST_CLOCK: "10:00" }, real)).toBe(real);
    expect(serverClock({ E2E_IST_CLOCK: "10:00" }, real)).toBe(real);
    for (const bad of ["25:00", "10:60", "10", "ten"]) expect(serverClock({ ...DEMO, E2E_IST_CLOCK: bad }, real)).toBe(real);
  });

  it("later in the day, starts at today's pinned time in India and runs on in real time", () => {
    const clock = ticking(AT_1520);
    const now = serverClock(DEMO, clock.real);
    expect(now().toISOString()).toBe("2026-11-22T04:30:00.000Z");
    clock.advance(90_000);
    expect(now().toISOString()).toBe("2026-11-22T04:31:30.000Z");
  });

  it("before the pinned time, goes back to yesterday's, never ahead of real time", () => {
    const now = serverClock(DEMO, () => AT_0013);
    expect(now().toISOString()).toBe("2026-11-21T04:30:00.000Z");
    expect(now().getTime()).toBeLessThan(AT_0013.getTime());
  });
});
