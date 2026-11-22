import { INDIA_TIME_ZONE } from "@/domain/time/clock";

type Env = Readonly<Record<string, string | undefined>>;

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/u;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Minutes since midnight in India for `at`. */
function indiaMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone: INDIA_TIME_ZONE,
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

/**
 * The server's clock. Signed-in E2E only (`playwright.emulators.config.ts`): `E2E_IST_CLOCK=HH:MM`
 * starts the clock at the latest such time in India (today, or yesterday when it is still earlier)
 * and lets it run on from there, so the plan specs do not depend on the hour they run at (plans
 * start at 5 am, spec 7.2). The stand-in's air series starts yesterday, so both days are covered.
 * Honoured only for a `demo-*` Firebase project (emulator-only, never a real deployment) and never
 * set on Vercel.
 */
export function serverClock(env: Env, real: () => Date = () => new Date()): () => Date {
  const pinned = HH_MM.exec(env.E2E_IST_CLOCK?.trim() ?? "");
  const demo = env.FIREBASE_PROJECT_ID?.startsWith("demo-") ?? false;
  if (!pinned || !demo) return real;
  const start = real();
  const target = Number(pinned[1]) * 60 + Number(pinned[2]);
  const sameDay = (target - indiaMinutes(start)) * MINUTE_MS - (start.getTime() % MINUTE_MS);
  // Never ahead of real time: a later time today would make a fresh sign-in look old (session.ts).
  const offset = sameDay > 0 ? sameDay - DAY_MS : sameDay;
  return () => new Date(real().getTime() + offset);
}
