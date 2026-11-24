import type { WindowDay } from "@/domain/air/summary";
import type { HourWindow } from "@/domain/air/windows";
import type { CareRow } from "@/domain/rules/publicAdvice";
import { formatWindow } from "@/domain/time/format";
import { translator, type Lang } from "@/i18n/t";
import { h2 } from "../ui/styles";
import { VerdictChip } from "./VerdictChip";

type Advice = "go" | "care" | "careNoWindow" | "careTomorrow" | "avoid" | "avoidNoWindow" | "avoidTomorrow";

/**
 * The advice line for a verdict, with the best window when there is one. After
 * 9 pm the window is tomorrow's, and the line says so.
 */
export function adviceKey(row: CareRow, windowDay: WindowDay | null): `air.care.${Advice}` {
  if (row.verdict === "go") return "air.care.go";
  if (windowDay === null) return `air.care.${row.verdict}NoWindow`;
  return windowDay === "tomorrow" ? `air.care.${row.verdict}Tomorrow` : `air.care.${row.verdict}`;
}

/** "Who should take care": Most people, and children, people over 60, asthma or heart. */
export function CareRows({
  rows,
  best,
  windowDay,
  lang,
}: {
  rows: readonly CareRow[];
  best: HourWindow | null;
  windowDay: WindowDay;
  lang: Lang;
}) {
  const t = translator(lang);
  const window = best ? formatWindow(best.start, best.end, lang) : "";
  return (
    <section aria-labelledby="care-h" className="grid gap-2">
      <h2 id="care-h" className={h2}>
        {t("air.care.title")}
      </h2>
      <ul className="m-0 list-none overflow-hidden rounded-[16px] border border-rule bg-card p-0">
        {rows.map((row) => (
          <li key={row.audience} className="grid gap-1.5 border-t border-rule px-4 py-3.5 first:border-t-0">
            <span className="font-bold">{t(`air.care.${row.audience}`)}</span>
            <VerdictChip verdict={row.verdict} lang={lang} />
            <span className="text-[0.9375em]">{t(adviceKey(row, best ? windowDay : null), { window })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
