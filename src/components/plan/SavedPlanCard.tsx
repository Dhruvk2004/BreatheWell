"use client";

import { Lock } from "lucide-react";
import { useMemo } from "react";
import { parseSavedPlan, useSavedPlanRaw, type SavedPlan } from "@/client/savedPlan";
import { freshness, verdictsAllowed } from "@/domain/air/freshness";
import { INDIA_TIME_ZONE } from "@/domain/time/clock";
import { translator } from "@/i18n/t";
import { VerdictChip } from "../air/VerdictChip";
import { noteNeutral } from "../ui/styles";

/** Verdict chips follow the freshness rule with the saved reading time. */
const chipsAllowed = (plan: SavedPlan, now: Date): boolean =>
  verdictsAllowed(freshness(new Date(plan.fetchedAt), { now, timeZone: INDIA_TIME_ZONE }));

/**
 * The saved plan shown when the network is gone: "You're offline.
 * Saved plan from 6:05 am · Updated air 6:00 am", then one line per person. Rows lose their chips
 * once the saved reading is over 12 h old. Nothing renders when no plan was saved.
 */
export function SavedPlanCard({ now = () => new Date() }: { now?: () => Date }) {
  const raw = useSavedPlanRaw();
  const plan = useMemo(() => parseSavedPlan(raw), [raw]);
  if (!plan) return null;
  const t = translator(plan.lang);
  const chips = chipsAllowed(plan, now());
  return (
    <section lang={plan.lang} aria-labelledby="saved-plan-h" className="grid gap-2">
      <h2 id="saved-plan-h" className="m-0 text-lg font-bold">
        {t("plan.savedTitle", { place: plan.place })}
      </h2>
      <p className={noteNeutral}>
        <Lock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t("plan.savedFrom", { time: plan.madeAt, air: plan.airAt })}
      </p>
      {!chips && <p className="m-0 text-sm text-ink-muted">{t("plan.savedOld")}</p>}
      <ul className="m-0 grid list-none gap-2 p-0">
        {plan.rows.map((row) => (
          <li key={row.name} className="grid gap-1 rounded-[16px] border border-rule bg-card p-3">
            <span className="font-bold">{row.name}</span>
            {chips && <VerdictChip verdict={row.verdict} lang={plan.lang} />}
            <span>{row.line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
