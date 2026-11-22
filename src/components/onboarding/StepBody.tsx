"use client";

import { Pencil } from "lucide-react";
import { translator } from "@/i18n/t";
import { btn } from "../ui/styles";
import { toInput, type Step } from "./draft";
import { ActivitiesStep } from "./steps/ActivitiesStep";
import { AboutStep } from "./steps/AboutStep";
import { AgeStep, HealthStep } from "./steps/HealthSteps";
import { QuickTravelStep, QuickWalkStep, TravelStep } from "./steps/TravelStep";
import type { StepProps } from "./steps/types";
import { Summary } from "./Summary";

/** The answer screen for one onboarding step. */
export function StepBody({ step, onEdit, ...props }: StepProps & { step: Exclude<Step, "start">; onEdit?: () => void }) {
  if (step === "about") return <AboutStep {...props} />;
  if (step === "aboutLanguage") return <AboutStep {...props} part="language" />;
  if (step === "aboutSize") return <AboutStep {...props} part="size" />;
  if (step === "aboutName") return <AboutStep {...props} part="name" />;
  if (step === "age") return <AgeStep {...props} />;
  if (step === "health" || step === "quickHealth") return <HealthStep {...props} quick={step === "quickHealth"} />;
  if (step === "activities") return <ActivitiesStep {...props} />;
  if (step === "travel") return <TravelStep {...props} />;
  if (step === "quickWalk") return <QuickWalkStep {...props} />;
  if (step === "quickTravel") return <QuickTravelStep {...props} />;
  const input = toInput(props.draft);
  return (
    <div className="grid gap-3">
      {input && <Summary input={input} lang={props.lang} />}
      {onEdit && (
        <button type="button" onClick={onEdit} className={`${btn.secondary} ${btn.small} w-max`}>
          <Pencil className="size-5" aria-hidden="true" />
          {translator(props.lang)("common.edit")}
        </button>
      )}
    </div>
  );
}
