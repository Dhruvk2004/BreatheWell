import { translator, type Lang } from "@/i18n/t";
import type { BreezyPerson } from "@/view/breezy";

const CHIP =
  "inline-flex min-h-11 items-center rounded-pill border-[1.5px] border-rule-strong bg-card px-3.5 font-bold text-ink aria-pressed:border-brand aria-pressed:bg-brand-tint";

interface PersonChipsProps {
  readonly people: readonly BreezyPerson[];
  readonly label: string;
  readonly chosen?: string | null;
  readonly onPick: (id: string) => void;
  readonly disabled?: boolean;
}

/** A row of person chips: the alias question and "Who is this for?" both use it. */
export function PersonChips({ people, label, chosen = null, onPick, disabled }: PersonChipsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {people.map((p) => (
        <button key={p.id} type="button" disabled={disabled} aria-pressed={chosen === p.id} onClick={() => onPick(p.id)} className={CHIP}>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** "Who is this for?" when a card came back without a person. */
export function WhoIsThisFor(props: Omit<PersonChipsProps, "label"> & { readonly lang: Lang }) {
  const t = translator(props.lang);
  return (
    <div className="grid gap-2">
      <p className="m-0 font-bold">{t("breezy.who")}</p>
      <PersonChips {...props} label={t("breezy.who")} />
    </div>
  );
}
