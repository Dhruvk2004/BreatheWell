import { z } from "zod";
import { nameSchema } from "../members/names";
import { conditionsConsistent } from "../rules/conditionTicks";
import type { Condition } from "../rules/groups";
import type { Mode } from "../rules/modes";
import { LANGS } from "../time/format";
import { DEPENDENT_DEFAULTS, type DependentChoice } from "./defaults";

/** Health ticks for a child or teen: optional. */
export const DEPENDENT_CONDITIONS = ["asthma", "heart", "allergies", "none", "not_sure"] as const satisfies readonly Condition[];
/** "How do they go to school?" and "Other ways they could go". */
export const DEPENDENT_MODES = ["walk", "cycle", "school_bus", "car", "auto_van"] as const satisfies readonly Mode[];
export const DEPENDENT_CHOICES = Object.keys(DEPENDENT_DEFAULTS) as DependentChoice[];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const pick = z.strictObject({
  choice: z.enum(DEPENDENT_CHOICES as [DependentChoice, ...DependentChoice[]]),
  times: z.array(z.string().regex(HHMM)).max(2).optional(),
});

/**
 * A child or teen as a parent describes them. Flexibility, duration and trip length are
 * not asked: `/api/dependent` fills them from the defaults table.
 */
export const dependentInput = z
  .strictObject({
    name: nameSchema(20),
    ageGroup: z.enum(["under13", "13to17"]),
    conditions: z.array(z.enum(DEPENDENT_CONDITIONS)).max(DEPENDENT_CONDITIONS.length),
    picks: z.array(pick).max(DEPENDENT_CHOICES.length),
    travel: z.strictObject({ main: z.enum(DEPENDENT_MODES), others: z.array(z.enum(DEPENDENT_MODES)).max(4) }),
    cardLanguage: z.enum(LANGS),
  })
  .refine((d) => new Set(d.picks.map((p) => p.choice)).size === d.picks.length, { path: ["picks"] })
  .refine((d) => conditionsConsistent(d.conditions), { path: ["conditions"] });

export type DependentInput = z.infer<typeof dependentInput>;
