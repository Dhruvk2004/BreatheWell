import { translator, type Lang } from "@/i18n/t";
import type { DependentDraft } from "./dependentDraft";

/** The default times a parent can change (spec 6.2: school 7–8 am and 1–2 pm, play 5–6 pm, tuition 7 pm). */
export function PickTimes({
  picks,
  onChange,
  lang,
}: {
  picks: DependentDraft["picks"];
  onChange: (picks: DependentDraft["picks"]) => void;
  lang: Lang;
}) {
  const t = translator(lang);
  if (picks.length === 0) return null;
  const setTime = (choice: string, index: number, value: string) =>
    onChange(picks.map((p) => (p.choice === choice ? { ...p, times: p.times.map((time, i) => (i === index ? value : time)) } : p)));
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {picks.flatMap((p) =>
        p.times.map((time, i) => {
          const id = `time-${p.choice}-${i}`;
          return (
            <div key={id} className="grid gap-1">
              <label htmlFor={id} className="font-bold">
                {t("dep.time", { activity: t(`dchoice.${p.choice}`), n: i + 1 })}
              </label>
              <input
                id={id}
                type="time"
                step={1800}
                value={time}
                onChange={(e) => e.target.value && setTime(p.choice, i, e.target.value)}
                className="min-h-12 rounded-xs border-[1.5px] border-rule-strong bg-card px-3.5"
              />
            </div>
          );
        }),
      )}
    </div>
  );
}
