"use client";

import { profileInput } from "@/domain/members/profile";
import { t, translator } from "@/i18n/t";
import { RadioGroup } from "../../form/Choice";
import { TextField } from "../../form/TextField";
import type { StepProps } from "./types";

function LanguageQuestion({ draft, set, lang }: StepProps) {
  return (
    <RadioGroup
      legend={translator(lang)("onb.language")}
      name="language"
      value={draft.language}
      onChange={(language) => set({ language })}
      options={[
        { value: "en", label: t("hi", "shell.lang.switch"), lang: "en" },
        { value: "hi", label: t("en", "shell.lang.switch"), lang: "hi" },
      ]}
    />
  );
}

function NameQuestion({ draft, set, lang, showErrors }: StepProps) {
  const tr = translator(lang);
  const nameOk = profileInput.shape.name.safeParse(draft.name).success;
  return (
    <TextField
      id="onb-name"
      label={tr("onb.name")}
      hint={tr("onb.nameHint", { name: draft.name.trim() || "…" })}
      value={draft.name}
      maxLength={30}
      autoComplete="nickname"
      onChange={(e) => set({ name: e.target.value })}
      error={showErrors && !nameOk ? tr("onb.nameError") : null}
    />
  );
}

/** Step 1 (spec 6.1): language and what the family calls you. */
export function AboutStep(props: StepProps) {
  return (
    <div className="grid gap-5">
      <LanguageQuestion {...props} />
      <NameQuestion {...props} />
    </div>
  );
}
