"use client";

import { ChevronLeft } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import type { OnboardingPage } from "@/view/app";
import { btn } from "../ui/styles";
import type { Step } from "./draft";
import { StepBody } from "./StepBody";
import { StartStep } from "./StartStep";
import { useOnboarding } from "./useOnboarding";

const NUMBERED: Partial<Record<Step, number>> = {
  about: 1,
  age: 2,
  health: 3,
  activities: 4,
  travel: 5,
};
const TITLE: Partial<Record<Step, "onb.summary" | "onb.about">> = {
  summary: "onb.summary",
  about: "onb.about",
};
const QUICK: Partial<Record<Step, number>> = { quickHealth: 1, quickWalk: 2, quickTravel: 3 };

/** "Step 2 of 5" or the quick path's "1 / 3", with the progress bar. */
function Progress({ step, lang }: { step: Step; lang: Lang }) {
  const t = translator(lang);
  const n = NUMBERED[step] ?? QUICK[step];
  if (!n) return null;
  const total = NUMBERED[step] ? 5 : 3;
  return (
    <div className="grid gap-1">
      <p className="m-0 text-sm font-bold text-ink-muted">
        {NUMBERED[step] ? t("onb.step", { n, total }) : t("quick.progress", { n, total })}
      </p>
      <div className="h-2 overflow-hidden rounded-pill bg-card-2" aria-hidden="true">
        <div className="h-full bg-brand" style={{ width: `${Math.round((n / total) * 100)}%` }} />
      </div>
    </div>
  );
}

/**
 * Onboarding (spec 10.5, 5.6): one screen at a time with Back and Next keeping every answer; the
 * standard five steps and a summary, or the 60+ quick path. Saved once, at the end.
 */
export function Onboarding({ page, lang }: { page: OnboardingPage; lang: Lang }) {
  const t = translator(lang);
  const { heading, draft, set, intent, setIntent, index, step, last, showErrors, status, back, next } = useOnboarding(page, lang);
  const title =
    step === "start"
      ? draft.name.trim()
        ? t("onb.welcome", { name: draft.name })
        : t("onb.welcomeAnon")
      : t(TITLE[step] ?? "onb.metaTitle");
  const action = status === "saving" ? "common.saving" : step === "summary" ? "onb.looksGood" : last ? "quick.done" : "common.next";
  return (
    <div className="mx-auto grid w-full max-w-[34rem] gap-5">
      {index > 0 && (
        <button type="button" onClick={back} className={`${btn.text} w-max`}>
          <ChevronLeft className="size-5" aria-hidden="true" />
          {t("common.back")}
        </button>
      )}
      <Progress step={step} lang={lang} />
      <h1 ref={heading} tabIndex={-1} className="m-0 text-2xl font-bold">
        {title}
      </h1>
      {step === "start" ? (
        <StartStep intent={intent} onChange={setIntent} removedFrom={page.removedFrom} lang={lang} />
      ) : (
        <StepBody step={step} draft={draft} set={set} lang={lang} showErrors={showErrors} onEdit={step === "summary" ? back : undefined} />
      )}
      <p role="alert" className="m-0 font-bold text-err empty:hidden">
        {status === "failed" ? t("onb.saveFailed") : ""}
      </p>
      <button type="button" onClick={next} disabled={status === "saving"} className={`${btn.primary} disabled:opacity-60`}>
        {t(action)}
      </button>
    </div>
  );
}
