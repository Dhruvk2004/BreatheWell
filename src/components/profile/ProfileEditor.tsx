"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveProfile } from "@/client/actions";
import type { ProfileInput } from "@/domain/members/profile";
import { translator, type Lang } from "@/i18n/t";
import { initialDraft, toInput, type Draft } from "../onboarding/draft";
import { ActivitiesStep } from "../onboarding/steps/ActivitiesStep";
import { AboutStep } from "../onboarding/steps/AboutStep";
import { AgeStep, HealthStep } from "../onboarding/steps/HealthSteps";
import { TravelStep } from "../onboarding/steps/TravelStep";
import { btn, h2 } from "../ui/styles";
import { failureText } from "../ui/failure";

function useProfileEditor(input: ProfileInput, lang: Lang) {
  const t = translator(lang);
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(input, input.name, lang));
  const [status, setStatus] = useState("");
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const save = async () => {
    const value = toInput(draft, true);
    if (!value) return setStatus(t("onb.saveFailed"));
    setStatus(t("common.saving"));
    try {
      await saveProfile(value);
      setStatus(t("common.saved"));
      router.refresh();
    } catch (error) {
      setStatus(failureText(error, lang, "onb.saveFailed"));
    }
  };
  return { draft, set, status, save };
}

/**
 * Profile settings items 1–3 (spec 10.15): the onboarding editors on one page, saved together
 * through `PUT /api/profile` (the same validation; the family plan is marked stale).
 */
export function ProfileEditor({ input, lang }: { input: ProfileInput; lang: Lang }) {
  const t = translator(lang);
  const { draft, set, status, save } = useProfileEditor(input, lang);
  const props = { draft, set, lang, showErrors: true };
  return (
    <div className="grid gap-6">
      <AboutStep {...props} />
      <AgeStep {...props} />
      <section aria-labelledby="health-h" className="grid gap-3">
        <h2 id="health-h" className={h2}>
          {t("prof.health")}
        </h2>
        <HealthStep {...props} />
      </section>
      <section aria-labelledby="acts-h" className="grid gap-3">
        <h2 id="acts-h" className={h2}>
          {t("prof.activities")}
        </h2>
        <ActivitiesStep {...props} />
        <TravelStep {...props} />
      </section>
      <p role="status" className="m-0 font-bold empty:hidden">
        {status}
      </p>
      <button type="button" onClick={() => void save()} className={btn.primary}>
        {t("prof.save")}
      </button>
    </div>
  );
}
