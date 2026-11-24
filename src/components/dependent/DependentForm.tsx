"use client";

import { Lock } from "lucide-react";
import { DEPENDENT_CHOICES, DEPENDENT_CONDITIONS, DEPENDENT_MODES } from "@/domain/dependents/schema";
import { nameSchema } from "@/domain/members/names";
import { modeKey } from "@/i18n/labels";
import { t as tIn, translator, type Lang } from "@/i18n/t";
import type { DependentPage } from "@/view/app";
import { CheckGroup, RadioGroup } from "../form/Choice";
import { TextField } from "../form/TextField";
import { btn, noteInfo } from "../ui/styles";
import { DeleteDependent } from "./DeleteDependent";
import { pickOutside, STAY_IN, toggleDependentConditions, type DependentDraft } from "./dependentDraft";
import { PickTimes } from "./PickTimes";
import { useDependentForm } from "./useDependentForm";

interface FieldsProps {
  readonly draft: DependentDraft;
  readonly set: (patch: Partial<DependentDraft>) => void;
  readonly who: string;
  readonly lang: Lang;
}

/** Add a child or teen, and Edit: one screen, the guardian note right above Save. */
export function DependentForm({ page, lang }: { page: DependentPage; lang: Lang }) {
  const t = translator(lang);
  const { draft, set, tried, busy, error, submit } = useDependentForm(page, lang);
  const who = draft.name.trim() || t("dep.theChild");
  const nameOk = nameSchema(20).safeParse(draft.name).success;
  return (
    <form onSubmit={submit} noValidate className="mx-auto grid w-full max-w-[34rem] gap-5">
      <h1 className="m-0 text-2xl font-bold">{page.id ? t("dep.editTitle", { name: page.input?.name ?? "" }) : t("dep.newTitle")}</h1>
      <TextField
        id="dep-name"
        label={t("dep.name")}
        value={draft.name}
        maxLength={20}
        onChange={(e) => set({ name: e.target.value })}
        error={tried && !nameOk ? t("dep.nameError") : null}
      />
      <AboutFields draft={draft} set={set} who={who} lang={lang} />
      <SchoolFields draft={draft} set={set} who={who} lang={lang} />
      <p className={`m-0 ${noteInfo}`}>
        <Lock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
        {t("dep.note", { name: who, family: page.familyName })}
      </p>
      <p role="alert" className="m-0 font-bold text-err empty:hidden">
        {error}
      </p>
      <button type="submit" disabled={busy} className={`${btn.primary} disabled:opacity-60`}>
        {busy ? t("common.saving") : t("dep.save")}
      </button>
      {page.id && page.canDelete && page.input && <DeleteDependent id={page.id} name={page.input.name} lang={lang} />}
    </form>
  );
}

/** Age group, health ticks, outside things and their times. */
function AboutFields({ draft, set, who, lang }: FieldsProps) {
  const t = translator(lang);
  const picked = draft.stayIn ? [STAY_IN] : draft.picks.map((p) => p.choice as string);
  const outside = [
    ...DEPENDENT_CHOICES.map((c) => ({ value: c as string, label: t(`dchoice.${c}`) })),
    { value: STAY_IN, label: t("dep.stayIn") },
  ];
  return (
    <>
      <RadioGroup
        legend={t("dep.age")}
        name="dep-age"
        value={draft.ageGroup}
        onChange={(ageGroup) => set({ ageGroup })}
        options={(["under13", "13to17"] as const).map((a) => ({ value: a, label: t(`age.${a}`) }))}
      />
      <CheckGroup
        legend={t("dep.health")}
        name="dep-health"
        values={draft.conditions}
        onChange={(next) => set({ conditions: toggleDependentConditions(next, draft.conditions) })}
        options={DEPENDENT_CONDITIONS.map((c) => ({ value: c, label: t(`dcond.${c}`) }))}
      />
      <CheckGroup
        legend={t("dep.outside", { name: who })}
        name="dep-outside"
        values={picked}
        max={draft.stayIn ? 1 : outside.length}
        onChange={(values) => set(pickOutside(draft, values))}
        options={outside}
      />
      <PickTimes picks={draft.picks} onChange={(picks) => set({ picks })} lang={lang} />
    </>
  );
}

/** How they go to school, the other ways, and the card language. */
function SchoolFields({ draft, set, who, lang }: FieldsProps) {
  const t = translator(lang);
  const others = DEPENDENT_MODES.filter((m) => m !== draft.main);
  return (
    <>
      <RadioGroup
        legend={t("dep.school", { name: who })}
        name="dep-main"
        value={draft.main}
        onChange={(main) => set({ main })}
        options={DEPENDENT_MODES.map((m) => ({ value: m, label: t(modeKey(m)) }))}
      />
      <CheckGroup
        legend={t("dep.others", { name: who })}
        hint={t("dep.othersHint")}
        name="dep-others"
        values={draft.others.filter((m) => m !== draft.main)}
        onChange={(values) => set({ others: values })}
        options={others.map((m) => ({ value: m, label: t(modeKey(m)) }))}
      />
      <RadioGroup
        legend={t("dep.cardLang")}
        name="dep-lang"
        value={draft.cardLanguage}
        onChange={(cardLanguage) => set({ cardLanguage })}
        options={[
          { value: "en", label: tIn("hi", "shell.lang.switch"), lang: "en" },
          { value: "hi", label: tIn("en", "shell.lang.switch"), lang: "hi" },
        ]}
      />
    </>
  );
}
