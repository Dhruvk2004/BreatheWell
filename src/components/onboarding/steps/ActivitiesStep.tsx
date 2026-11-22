"use client";

import { ADULT_CHOICES, TIME_BANDS, type ActivityInput } from "@/domain/members/profile";
import { activityKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import { CheckGroup, RadioGroup } from "../../form/Choice";
import { pickActivities, STAY_IN } from "../draft";
import type { StepProps } from "./types";

/** Step 4 (spec 6.1 items 6–6c): pick up to 4, then one card per activity: time → can it move → how long. */
export function ActivitiesStep({ draft, set, lang, showErrors }: StepProps) {
  const t = translator(lang);
  const picked = draft.stayIn ? [STAY_IN] : draft.activities.map((a) => a.type);
  const update = (type: ActivityInput["type"], patch: Partial<ActivityInput>) =>
    set({ activities: draft.activities.map((a) => (a.type === type ? { ...a, ...patch } : a)) });
  return (
    <div className="grid gap-5">
      <CheckGroup
        legend={t("onb.activities")}
        hint={t("onb.activitiesHint")}
        name="activities"
        values={picked as string[]}
        max={draft.stayIn ? 1 : 4}
        onChange={(values) => set(pickActivities(draft, values))}
        options={[
          ...ADULT_CHOICES.map((c) => ({ value: c as string, label: t(activityKey(c)) })),
          { value: STAY_IN, label: t("onb.stayIn") },
        ]}
      />
      {showErrors && picked.length === 0 && (
        <p aria-live="polite" className="m-0 font-bold text-err">
          {t("onb.activitiesHint")}
        </p>
      )}
      {draft.activities.map((a) => (
        <ActivityCard key={a.type} activity={a} lang={lang} onChange={(patch) => update(a.type, patch)} />
      ))}
    </div>
  );
}

const FLEX = [
  { value: "fixed", key: "flex.fixed", hint: "flex.fixedHint" },
  { value: "some", key: "flex.some" },
  { value: "any", key: "flex.any" },
] as const;
const DURATIONS = ["under15", "15to60", "over60"] as const;

type Change = (patch: Partial<ActivityInput>) => void;

/** One card per activity (design 10.5): usual time → can it move → how long, each saying why it matters. */
function ActivityCard({ activity, lang, onChange }: { activity: ActivityInput; lang: Lang; onChange: Change }) {
  const t = translator(lang);
  const id = activity.type;
  return (
    <section aria-label={t(activityKey(id))} className="grid gap-4 rounded-[16px] border border-rule bg-card p-4">
      <h3 className="m-0 text-lg font-bold">{t(activityKey(id))}</h3>
      <RadioGroup
        legend={t("onb.usual")}
        name={`${id}-band`}
        columns={3}
        value={activity.band}
        onChange={(band) => onChange({ band })}
        options={TIME_BANDS.map((b) => ({ value: b, label: t(`timeBand.${b}`) }))}
      />
      <FlexAndDuration activity={activity} lang={lang} onChange={onChange} />
    </section>
  );
}

function FlexAndDuration({ activity, lang, onChange }: { activity: ActivityInput; lang: Lang; onChange: Change }) {
  const t = translator(lang);
  const id = activity.type;
  const flex = FLEX.map((f) => ({ value: f.value, label: t(f.key), hint: "hint" in f ? t(f.hint) : undefined }));
  return (
    <>
      <RadioGroup
        legend={t("onb.flex")}
        name={`${id}-flex`}
        columns={1}
        value={activity.flex}
        onChange={(v) => onChange({ flex: v })}
        options={flex}
      />
      <RadioGroup
        legend={t("onb.duration")}
        name={`${id}-duration`}
        columns={3}
        value={activity.duration}
        onChange={(duration) => onChange({ duration })}
        options={DURATIONS.map((d) => ({ value: d, label: t(`duration.${d}`) }))}
      />
    </>
  );
}
