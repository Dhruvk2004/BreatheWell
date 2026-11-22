import { translator, type Lang, type MessageKey } from "@/i18n/t";
import type { BreezyPerson } from "@/view/breezy";

/** Suggested prompts in the viewer's language (spec 7.7.8; Hindi chips for Hindi readers). */
export const PROMPT_CHIPS: readonly MessageKey[] = [
  "breezy.chip.walk",
  "breezy.chip.mask",
  "breezy.chip.goOut",
  "breezy.chip.windows",
  "breezy.chip.sunday",
];

export interface Chip {
  readonly id: string;
  readonly label: string;
}

/**
 * The chips with the family's own names (spec 7.7.8): "When should Dadaji walk today?" for another
 * adult and "Plan Riya's evening" for the first dependent, then the general ones.
 */
export function familyChips(people: readonly BreezyPerson[], viewerId: string, lang: Lang): Chip[] {
  const t = translator(lang);
  const other = people.find((p) => p.kind === "adult" && p.id !== viewerId);
  const child = people.find((p) => p.kind === "dependent");
  const walk: Chip = other
    ? { id: "whenWalk", label: t("breezy.chip.whenWalk", { name: other.name }) }
    : { id: "walk", label: t("breezy.chip.walk") };
  const evening: Chip[] = child ? [{ id: "planEvening", label: t("breezy.chip.planEvening", { name: child.name }) }] : [];
  const rest = PROMPT_CHIPS.filter((key) => key !== "breezy.chip.walk").map((key) => ({ id: key, label: t(key) }));
  return [walk, rest[0], ...evening, ...rest.slice(1)];
}

const CHIP =
  "inline-flex min-h-11 items-center rounded-pill border-[1.5px] border-ai bg-card px-3.5 text-left font-bold text-ai disabled:opacity-60";

interface PromptChipsProps {
  readonly lang: Lang;
  readonly chips: readonly Chip[];
  readonly disabled?: boolean;
  readonly onPick: (id: string, label: string) => void;
}

export function PromptChips({ lang, chips, disabled, onPick }: PromptChipsProps) {
  return (
    <div role="group" aria-label={translator(lang)("breezy.chipsLabel")} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button key={chip.id} type="button" disabled={disabled} onClick={() => onPick(chip.id, chip.label)} className={CHIP}>
          {chip.label}
        </button>
      ))}
    </div>
  );
}
