"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveProfile } from "@/client/actions";
import type { Lang } from "@/i18n/t";
import type { OnboardingPage } from "@/view/app";
import { initialDraft, sameStep, stepReady, stepsFor, toInput, type Draft, type Step } from "./draft";
import type { Intent } from "./StartStep";

/**
 * The onboarding wizard's state: the draft, the current step, Back/Next with focus
 * moved to the new heading, and the one save at the end (then Create family, Join or Today).
 */
export function useOnboarding(page: OnboardingPage, lang: Lang) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(page.input, page.googleName, lang));
  const [intent, setIntent] = useState<Intent>("start");
  const [current, setCurrent] = useState<Step | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");
  const steps = stepsFor(draft, !page.hasFamily);
  const index = current ? sameStep(steps, current) : 0;
  const step = steps[index];
  const last = index >= steps.length - 1;
  const go = (to: number) => {
    setShowErrors(false);
    setCurrent(steps[to]);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const save = async () => {
    const input = toInput(draft);
    if (!input) return setShowErrors(true);
    setStatus("saving");
    try {
      await saveProfile(input);
      router.push(page.hasFamily ? "/today" : intent === "join" ? "/join" : "/family/new");
    } catch {
      setStatus("failed");
    }
  };
  const next = () => (!stepReady(step, draft) ? setShowErrors(true) : last ? void save() : go(index + 1));
  const set = (patch: Partial<Draft>) => {
    if (!current) setCurrent(step); // pin the place before the age answer changes the path
    setDraft((d) => ({ ...d, ...patch }));
  };
  return { heading, draft, set, intent, setIntent, index, step, last, showErrors, status, back: () => go(index - 1), next };
}
