/**
 * Travel modes and the essential-trip order.
 * "Auto or bus" (adults) and "Auto or van" (dependents) are open travel.
 */
export const MODES = ["walk", "cycle", "two_wheeler", "auto_bus", "auto_van", "school_bus", "metro", "carpool", "car", "home"] as const;
export type Mode = (typeof MODES)[number];

/** Enclosed travel is Light and halves outdoor exposure. */
const ENCLOSED: readonly Mode[] = ["metro", "school_bus", "carpool", "car", "home"];

/**
 * The modes an essential trip may switch to, safest first: shared enclosed modes, then the own car.
 * Every open mode (auto, bus, walk, cycle, two-wheeler) is Moderate travel
 * with the same verdict, so they rank together after these and a switch between them is never offered.
 */
export const SAFEST_ORDER: readonly Mode[] = ["metro", "school_bus", "carpool", "car"];

/** True for enclosed modes (metro, school bus, carpool, car with recirculation). */
export const isEnclosed = (mode: Mode): boolean => ENCLOSED.includes(mode);

/** True for shared modes, which also help the air. */
export const isShared = (mode: Mode): boolean => mode === "metro" || mode === "school_bus" || mode === "carpool" || mode === "auto_bus";

/**
 * The safest enclosed mode the person can actually use instead of the current one: the first of
 * SAFEST_ORDER that is in `options` and ranks above `current`. Null if none is safer (then the
 * trip is protected in place).
 */
export function safestSwitch(current: Mode, options: readonly Mode[]): Mode | null {
  const rank = (mode: Mode) => {
    const i = SAFEST_ORDER.indexOf(mode);
    return i === -1 ? SAFEST_ORDER.length : i;
  };
  const candidates = options.filter((m) => m !== current && rank(m) < rank(current));
  candidates.sort((a, b) => rank(a) - rank(b));
  return candidates[0] ?? null;
}
