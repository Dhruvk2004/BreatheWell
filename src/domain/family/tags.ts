import type { Band } from "../air/bands";
import type { RuleContext } from "../rules/context";
import { ruleBand } from "../rules/context";
import type { CareTag, Condition } from "../rules/groups";
import { verdict, type Verdict } from "../rules/verdict";

/**
 * The family plans an adult with their tag only; the condition names stay in their private health
 * doc (spec 6.5). One stand-in condition per tag gives the same sensitivity group for every age
 * (tested), so the one verdict table still decides.
 */
export const TAG_CONDITIONS: Readonly<Record<CareTag, readonly Condition[]>> = {
  none: [],
  sensitive: ["not_sure"],
  extra: ["asthma"],
};

/**
 * A member still setting up (spec 5.11, 10.8): "uses the Sensitive group's verdicts for a moderate
 * activity now", so the row is careful until they answer.
 */
export const settingUpVerdict = (band: Band, ctx: RuleContext): Verdict =>
  verdict(ruleBand(band, "sensitive", ctx), "sensitive", "moderate");
