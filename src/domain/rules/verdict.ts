import type { Band } from "../air/bands";
import type { Intensity } from "./activities";
import type { Group } from "./groups";

/** Go = fine as planned; Care = go with care; Avoid = not outdoors in this hour. */
export type Verdict = "go" | "care" | "avoid";

type Row = Readonly<Record<Group, readonly [Verdict, Verdict, Verdict]>>;

/** Band × group × (Light, Moderate, Hard), exactly as the spec 8.3 table. */
const GUARDRAIL: Readonly<Record<Band, Row>> = {
  good: { everyday: ["go", "go", "go"], sensitive: ["go", "go", "go"], extra: ["go", "go", "go"] },
  satisfactory: { everyday: ["go", "go", "go"], sensitive: ["go", "go", "go"], extra: ["go", "go", "care"] },
  moderate: { everyday: ["go", "go", "go"], sensitive: ["go", "go", "care"], extra: ["go", "care", "avoid"] },
  poor: { everyday: ["go", "care", "care"], sensitive: ["care", "care", "avoid"], extra: ["care", "avoid", "avoid"] },
  very_poor: { everyday: ["care", "care", "avoid"], sensitive: ["care", "avoid", "avoid"], extra: ["avoid", "avoid", "avoid"] },
  severe: { everyday: ["care", "avoid", "avoid"], sensitive: ["avoid", "avoid", "avoid"], extra: ["avoid", "avoid", "avoid"] },
};

const COLUMN: Readonly<Record<Intensity, 0 | 1 | 2>> = { light: 0, moderate: 1, hard: 2 };

/** The guardrail verdict for a band, sensitivity group and activity type. Pure; the only verdict table. */
export function verdict(band: Band, group: Group, intensity: Intensity): Verdict {
  return GUARDRAIL[band][group][COLUMN[intensity]];
}

/** Go = 0, Care = 1, Avoid = 2: lower is better. */
export const verdictRank = (v: Verdict): number => (v === "go" ? 0 : v === "care" ? 1 : 2);

/** The worst of several verdicts (Go for an empty list). */
export function worstVerdict(verdicts: readonly Verdict[]): Verdict {
  return verdicts.reduce<Verdict>((worst, v) => (verdictRank(v) > verdictRank(worst) ? v : worst), "go");
}
