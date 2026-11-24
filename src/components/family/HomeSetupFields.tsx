"use client";

import type { HomeSetup } from "@/domain/libraries/homeSetup";
import { translator, type Lang } from "@/i18n/t";
import { RadioGroup } from "../form/Choice";
import { asAnswer, fromAnswer, QUESTIONS } from "./homeSetup";

export { BLANK_HOME } from "./homeSetup";

/** Home set-up: one group per card, each saying why it changes the advice. */
export function HomeSetupFields({ value, onChange, lang }: { value: HomeSetup; onChange: (v: HomeSetup) => void; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-3">
      {QUESTIONS.map((q) => (
        <div key={q.key} className="rounded-[16px] border border-rule bg-card p-4">
          <RadioGroup
            legend={t(q.label)}
            hint={t(q.why)}
            name={q.key}
            columns={q.key === "fuel" ? 1 : 3}
            value={asAnswer(value, q.key)}
            onChange={(answer) => onChange({ ...value, ...fromAnswer(q.key, answer) })}
            options={q.answers.map(([v, label]) => ({ value: v, label: t(label) }))}
          />
        </div>
      ))}
    </div>
  );
}
