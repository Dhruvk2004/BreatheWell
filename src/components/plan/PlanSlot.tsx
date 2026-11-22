"use client";

import { Lock, Wind } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { useOnline } from "@/client/online";
import { askForPlan } from "@/client/plan";
import { translator, type Lang } from "@/i18n/t";
import type { PlanWords } from "@/view/app";
import { aiLine, btn, noteNeutral, sourceLine } from "../ui/styles";

interface PlanSlotProps {
  readonly words: Pick<PlanWords, "source" | "pending" | "capped" | "canRetry">;
  /** "6:05 am": when the Gemini plan was written. */
  readonly madeAt: string | null;
  /** "6:00 am": the air reading's time. */
  readonly airAt: string;
  readonly lang: Lang;
}

type Phase = "idle" | "working" | "failed";

/**
 * The one reserved slot under "Your family today" (design F, G `PlanBadge` / `PlanSourceLine`): the
 * "Personalising today's plan…" badge while Gemini works, then the source line in the same slot,
 * so the rows never move. The answer above it is already on screen from code. On "ready" the page
 * is refreshed inside a transition, so the badge stays until the new words arrive and then gives
 * way to the source line together with them.
 */
export function PlanSlot({ words, madeAt, airAt, lang }: PlanSlotProps) {
  const t = translator(lang);
  const online = useOnline();
  const plan = usePlanRequest(words.pending);
  const working = online && plan.working;
  const showRetry = online && !working && (plan.failed || words.canRetry) && words.source !== "gemini";
  return (
    <div className="grid min-h-8 content-start gap-1">
      <div role="status" className="grid min-h-8 items-center">
        <span
          data-shown={working}
          aria-hidden={!working}
          className="plan-fade plan-badge inline-flex w-max items-center gap-1.5 rounded-pill bg-ai-tint px-3 py-1 text-sm font-bold text-ai"
        >
          <Wind className="size-4" aria-hidden="true" />
          {t("plan.personalising")}
        </span>
        <div data-shown={!working} aria-hidden={working} className="plan-fade">
          <SourceLine online={online} gemini={words.source === "gemini"} madeAt={madeAt} airAt={airAt} lang={lang} />
        </div>
      </div>
      {showRetry && (
        <p className={`${noteNeutral} flex-wrap items-center`}>
          {t("plan.simpleFailed")}
          <button type="button" className={`${btn.text} p-0`} onClick={() => void plan.ask(true)}>
            {t("plan.tryAgain")}
          </button>
        </p>
      )}
      {words.capped && <p className={sourceLine}>{t("plan.capped")}</p>}
      <p className={sourceLine}>{t("demo.rulesCaption")}</p>
    </div>
  );
}

/**
 * Asks `POST /api/plan` once per page view while the plan is pending, and again on Try again. On
 * "ready" the page is refreshed inside a transition, so `working` stays true until the new words
 * have arrived (review H1: the badge never outlives the refresh).
 */
function usePlanRequest(pending: boolean) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(pending ? "working" : "idle");
  const [refreshing, startRefresh] = useTransition();
  const asked = useRef(false);
  const ask = async (retry: boolean) => {
    setPhase("working");
    const result = await askForPlan(retry);
    if (result === "simple") return setPhase("failed");
    startRefresh(() => {
      setPhase("idle");
      router.refresh();
    });
  };
  const askOnOpen = useEffectEvent(() => void ask(false));
  useEffect(() => {
    if (!pending || asked.current) return;
    asked.current = true;
    askOnOpen();
  }, [pending]);
  return { working: phase === "working" || refreshing, failed: phase === "failed", ask };
}

interface SourceLineProps {
  readonly online: boolean;
  readonly gemini: boolean;
  readonly madeAt: string | null;
  readonly airAt: string;
  readonly lang: Lang;
}

/** One of the three source lines: Monsoon "Made by", neutral "Simple plan", or "Saved plan" offline. */
function SourceLine({ online, gemini, madeAt, airAt, lang }: SourceLineProps) {
  const t = translator(lang);
  if (!online)
    return (
      <p className={`${sourceLine} flex items-start gap-1.5`}>
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("plan.savedFrom", { time: madeAt ?? airAt, air: airAt })}
      </p>
    );
  if (gemini && madeAt)
    return (
      <p className={aiLine}>
        <Wind className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("plan.madeBy", { time: madeAt, air: airAt })}
      </p>
    );
  return <p className={sourceLine}>{t("demo.simplePlan", { time: airAt })}</p>;
}
