"use client";

import { TEXT_SIZES } from "@/components/prefs/cookies";
import { setTextSize, useTextSize } from "@/components/prefs/textSize";
import { profileInput } from "@/domain/members/profile";
import { t, translator } from "@/i18n/t";
import { RadioGroup } from "../../form/Choice";
import { TextField } from "../../form/TextField";
import type { StepProps } from "./types";

/** Which questions of step 1 this screen asks: all three, or one in large-text mode. */
export type AboutShown = "all" | "language" | "size" | "name";

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

/** The size applies at once; until it is picked, the size on screen is shown as chosen. */
function SizeQuestion({ draft, set, lang, wide }: StepProps & { readonly wide: boolean }) {
  const tr = translator(lang);
  const onScreen = useTextSize();
  return (
    <RadioGroup
      legend={tr("onb.textSize")}
      name="textSize"
      columns={wide ? 3 : 1}
      value={draft.textSize ?? onScreen}
      onChange={(textSize) => {
        setTextSize(textSize);
        set({ textSize });
      }}
      options={TEXT_SIZES.map((size) => ({ value: size, label: tr(`shell.textSize.${size}`) }))}
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

/** Step 1 (spec 6.1 items 1–3): language, text size and what the family calls you. */
export function AboutStep({ part = "all", ...props }: StepProps & { readonly part?: AboutShown }) {
  const shows = (which: AboutShown) => part === "all" || part === which;
  return (
    <div className="grid gap-5">
      {shows("language") && <LanguageQuestion {...props} />}
      {shows("size") && <SizeQuestion {...props} wide={part === "all"} />}
      {shows("name") && <NameQuestion {...props} />}
    </div>
  );
}
