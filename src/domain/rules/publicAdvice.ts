import type { Band } from "../air/bands";
import { ruleBand, type RuleContext } from "./context";
import { verdict, worstVerdict, type Verdict } from "./verdict";

/** The two "Who should take care" rows on Air now (spec 10.2 item 5). */
export type CareAudience = "most" | "sensitive";

export interface CareRow {
  readonly audience: CareAudience;
  /** The verdict for a moderate outdoor activity (a 15–60 min walk) in the hour shown. */
  readonly verdict: Verdict;
}

/**
 * Air now's public advice, from the one verdict table (spec 8.3): "Most people" is the Everyday
 * group; "Children, people over 60, asthma or heart" takes the stricter of Sensitive and Extra care
 * (with the winter caution where it applies), so nobody in that row is told more than is safe.
 */
export function whoShouldTakeCare(band: Band, ctx: RuleContext): CareRow[] {
  const sensitive = worstVerdict([verdict(band, "sensitive", "moderate"), verdict(ruleBand(band, "extra", ctx), "extra", "moderate")]);
  return [
    { audience: "most", verdict: verdict(band, "everyday", "moderate") },
    { audience: "sensitive", verdict: sensitive },
  ];
}
