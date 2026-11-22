import { toggleConditionTicks } from "@/domain/rules/conditionTicks";
import { DEFAULT_OTHER_MODES, DEPENDENT_DEFAULTS, type DependentChoice } from "@/domain/dependents/defaults";
import { dependentInput, type DependentInput } from "@/domain/dependents/schema";
import type { Lang } from "@/domain/time/format";

/** The Add a child or teen form's answers (spec 6.2), before they are checked. */
export interface DependentDraft {
  readonly name: string;
  readonly ageGroup: DependentInput["ageGroup"] | null;
  readonly conditions: DependentInput["conditions"];
  /** The picked activities with their (changeable) default times. */
  readonly picks: readonly { readonly choice: DependentChoice; readonly times: readonly string[] }[];
  readonly stayIn: boolean;
  readonly main: DependentInput["travel"]["main"] | null;
  readonly others: DependentInput["travel"]["others"];
  readonly cardLanguage: Lang;
}

export function dependentDraft(saved: DependentInput | null, guardianLang: Lang): DependentDraft {
  return {
    name: saved?.name ?? "",
    ageGroup: saved?.ageGroup ?? null,
    conditions: saved?.conditions ?? [],
    picks: saved?.picks.map((p) => ({ choice: p.choice, times: p.times ?? DEPENDENT_DEFAULTS[p.choice].times })) ?? [],
    stayIn: saved ? saved.picks.length === 0 : false,
    main: saved?.travel.main ?? null,
    others: saved?.travel.others ?? (DEFAULT_OTHER_MODES as DependentInput["travel"]["others"]),
    cardLanguage: saved?.cardLanguage ?? guardianLang,
  };
}

/** The "Mostly stays in" tile, which stands alone. */
export const STAY_IN = "stay_in";

/** The outside-things tiles' new values → the draft: stays in alone, or the picks with their times kept. */
export function pickOutside(draft: DependentDraft, values: readonly string[]): Partial<DependentDraft> {
  if (values.includes(STAY_IN) && !draft.stayIn) return { stayIn: true, picks: [] };
  const choices = values.filter((v): v is DependentChoice => v !== STAY_IN && v in DEPENDENT_DEFAULTS);
  const kept = draft.picks.filter((p) => choices.includes(p.choice));
  const added = choices
    .filter((c) => !kept.some((p) => p.choice === c))
    .map((choice) => ({ choice, times: DEPENDENT_DEFAULTS[choice].times }));
  return { stayIn: false, picks: [...kept, ...added] };
}

/** "None" and "Not sure" stand alone. */
export const toggleDependentConditions = (
  next: DependentInput["conditions"],
  before: DependentInput["conditions"],
): DependentInput["conditions"] => toggleConditionTicks(next, before);

/** The body for `/api/dependent`, or null while something required is missing or invalid. */
export function dependentBody(draft: DependentDraft): DependentInput | null {
  if (!draft.ageGroup || !draft.main || (!draft.stayIn && draft.picks.length === 0)) return null;
  const parsed = dependentInput.safeParse({
    name: draft.name,
    ageGroup: draft.ageGroup,
    conditions: draft.conditions,
    picks: draft.stayIn ? [] : draft.picks.map((p) => ({ choice: p.choice, times: [...p.times] })),
    travel: { main: draft.main, others: draft.others.filter((m) => m !== draft.main) },
    cardLanguage: draft.cardLanguage,
  });
  return parsed.success ? parsed.data : null;
}
