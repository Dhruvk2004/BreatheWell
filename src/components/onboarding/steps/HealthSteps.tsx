"use client";

import { ADULT_CONDITIONS, SHARE_WITH } from "@/domain/members/profile";
import { setTextSize, useTextSize } from "@/components/prefs/textSize";
import { translator } from "@/i18n/t";
import { CheckGroup, RadioGroup } from "../../form/Choice";
import { toggleConditions } from "../draft";
import type { StepProps } from "./types";

/** Step 2 (spec 6.1 item 4): only the two adult groups; 60+ pre-selects Large text and starts the quick path. */
export function AgeStep({ draft, set, lang }: StepProps) {
  const t = translator(lang);
  const onScreen = useTextSize();
  const choose = (ageGroup: NonNullable<StepProps["draft"]["ageGroup"]>) => {
    const larger = ageGroup === "60plus" && (draft.textSize ?? onScreen) === "md";
    if (larger) setTextSize("lg");
    set({ ageGroup, ...(larger ? { textSize: "lg" as const } : {}) });
  };
  return (
    <div className="grid gap-3">
      <RadioGroup
        legend={t("onb.age")}
        name="ageGroup"
        value={draft.ageGroup}
        onChange={choose}
        options={[
          { value: "18to59", label: t("age.18to59") },
          { value: "60plus", label: t("age.60plus"), hint: t("onb.ageHint") },
        ]}
      />
      <p className="m-0 text-sm text-ink-muted">{t("onb.ageAdults")}</p>
    </div>
  );
}

/**
 * Step 3 and quick-path Q1 (spec 6.1 items 5–5a): optional ticks, then who can see them, shown
 * only once something is ticked. The family only ever sees the tag.
 */
export function HealthStep({ draft, set, lang, quick = false }: StepProps & { quick?: boolean }) {
  const t = translator(lang);
  const options = ADULT_CONDITIONS.filter((c) => c !== "pregnant" || draft.ageGroup !== "60plus");
  const ticked = draft.conditions.some((c) => c !== "none" && c !== "prefer_not");
  return (
    <div className="grid gap-5">
      <CheckGroup
        legend={t(quick ? "quick.health" : "onb.health")}
        name="conditions"
        values={draft.conditions}
        onChange={(next) => set({ conditions: toggleConditions(next, draft.conditions) })}
        options={options.map((c) => ({ value: c, label: t(`cond.${c}`) }))}
      />
      {ticked && (
        <RadioGroup
          legend={t("onb.shareWith")}
          name="shareWith"
          columns={3}
          value={draft.shareWith}
          onChange={(shareWith) => set({ shareWith })}
          hint={t(quick ? "quick.shareHint" : "onb.shareHint")}
          options={SHARE_WITH.map((s) => ({ value: s, label: t(`shareWith.${s}`) }))}
        />
      )}
    </div>
  );
}
