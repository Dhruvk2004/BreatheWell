import type { ReactNode } from "react";

/**
 * Picture-tile choices: native radio and checkbox inputs inside a fieldset with a
 * legend, so keyboard, screen readers and forms work without extra code. Tiles are ≥ 48 px and the
 * chosen one is marked by colour, border and a bold label, never colour alone.
 */
export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
  readonly lang?: string;
}

const TILE =
  "flex min-h-12 cursor-pointer items-start gap-2.5 rounded-sm border-[1.5px] border-rule-strong bg-card px-3.5 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:checked]:font-bold";

interface GroupProps<T extends string> {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly ChoiceOption<T>[];
  readonly hint?: ReactNode;
  readonly columns?: 1 | 2 | 3;
}

const GRID = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3" } as const;

function Group<T extends string>({ legend, hint, columns = 2, children }: GroupProps<T> & { children: ReactNode }) {
  return (
    <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-lg font-bold">{legend}</legend>
      {hint && <p className="m-0 -mt-1 text-sm text-ink-muted">{hint}</p>}
      <div className={`grid gap-2 ${GRID[columns]}`}>{children}</div>
    </fieldset>
  );
}

function Tile({ label, hint, lang, input }: { label: string; hint?: string; lang?: string; input: ReactNode }) {
  return (
    <label className={TILE} lang={lang}>
      {input}
      <span className="grid gap-0.5">
        <span>{label}</span>
        {hint && <span className="text-sm font-normal text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}

const INPUT = "mt-1 size-5 shrink-0 accent-[var(--color-primary)]";

/** One answer from a few (age group, language, time band). */
export function RadioGroup<T extends string>(props: GroupProps<T> & { value: T | null; onChange: (value: T) => void }) {
  const { name, options, value, onChange } = props;
  return (
    <Group {...props}>
      {options.map((o) => (
        <Tile
          key={o.value}
          label={o.label}
          hint={o.hint}
          lang={o.lang}
          input={
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className={INPUT}
            />
          }
        />
      ))}
    </Group>
  );
}

/** Any number of answers, up to `max` (activities, health ticks, other travel modes). */
export function CheckGroup<T extends string>(
  props: GroupProps<T> & { values: readonly T[]; onChange: (values: T[]) => void; max?: number },
) {
  const { name, options, values, onChange, max = options.length } = props;
  const toggle = (v: T) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <Group {...props}>
      {options.map((o) => (
        <Tile
          key={o.value}
          label={o.label}
          hint={o.hint}
          lang={o.lang}
          input={
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={values.includes(o.value)}
              disabled={!values.includes(o.value) && values.length >= max}
              onChange={() => toggle(o.value)}
              className={INPUT}
            />
          }
        />
      ))}
    </Group>
  );
}
