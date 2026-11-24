"use client";

import { ADULT_MODES } from "@/domain/members/profile";
import { QUICK_TRAVEL, QUICK_WALKS } from "@/domain/members/quickPath";
import { modeKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import { CheckGroup, RadioGroup } from "../../form/Choice";
import type { StepProps } from "./types";

const modeLabel = (mode: (typeof ADULT_MODES)[number], lang: Lang) => translator(lang)(mode === "home" ? "onb.fromHome" : modeKey(mode));

/** Step 5: main way, trip length (not when from home) and the other ways. */
export function TravelStep({ draft, set, lang }: StepProps) {
  const t = translator(lang);
  const { travel } = draft;
  const others = ADULT_MODES.filter((m) => m !== "home" && m !== travel.main);
  return (
    <div className="grid gap-5">
      <RadioGroup
        legend={t("onb.travel")}
        name="main"
        value={travel.main}
        onChange={(main) => set({ travel: { ...travel, main } })}
        options={ADULT_MODES.map((m) => ({ value: m, label: modeLabel(m, lang) }))}
      />
      {travel.main !== "home" && (
        <RadioGroup
          legend={t("onb.trip")}
          name="tripLength"
          columns={3}
          value={travel.tripLength}
          onChange={(tripLength) => set({ travel: { ...travel, tripLength } })}
          options={(["under15", "15to45", "over45"] as const).map((v) => ({ value: v, label: t(`trip.${v}`) }))}
        />
      )}
      <CheckGroup
        legend={t("onb.others")}
        name="others"
        values={travel.others.filter((m) => m !== travel.main)}
        onChange={(values) => set({ travel: { ...travel, others: values as typeof travel.others } })}
        options={others.map((m) => ({ value: m, label: modeLabel(m, lang) }))}
      />
    </div>
  );
}

/** Quick path Q2: "Is there a morning or evening walk? When?" Big single choices. */
export function QuickWalkStep({ draft, set, lang }: StepProps) {
  const t = translator(lang);
  return (
    <div className="grid gap-3">
      <RadioGroup
        legend={t("quick.walk")}
        name="quickWalk"
        columns={1}
        value={draft.quickWalk}
        onChange={(quickWalk) => set({ quickWalk })}
        options={QUICK_WALKS.map((w) => ({ value: w, label: t(`quickWalk.${w}`) }))}
      />
      <p className="m-0 text-ink-muted">{t("quick.rest")}</p>
    </div>
  );
}

/** Quick path Q3: "How do you usually get around?" */
export function QuickTravelStep({ draft, set, lang }: StepProps) {
  const t = translator(lang);
  return (
    <RadioGroup
      legend={t("quick.travel")}
      name="quickTravel"
      columns={1}
      value={draft.quickTravel}
      onChange={(quickTravel) => set({ quickTravel })}
      options={QUICK_TRAVEL.map((m) => ({ value: m, label: t(m === "home" ? "quick.stayIn" : modeKey(m)) }))}
    />
  );
}
