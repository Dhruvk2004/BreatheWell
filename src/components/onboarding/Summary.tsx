import { Bus, Lock, Sun, TrainFront } from "lucide-react";
import type { ProfileInput } from "@/domain/members/profile";
import { activityKey, modeKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";

/** "Your plan is based on": one line per activity, the travel, the other ways and health. */
export function Summary({ input, lang }: { input: ProfileInput; lang: Lang }) {
  const t = translator(lang);
  const health =
    input.conditions.length === 0 || input.conditions.every((c) => c === "none" || c === "prefer_not") ? "none" : input.shareWith;
  const lines = [
    ...input.activities.map((a) => ({
      Icon: Sun,
      text: `${t(activityKey(a.type))} · ${t(`timeBand.${a.band}`)} · ${t(`flex.${a.flex}`)} · ${t(`duration.${a.duration}`)}`,
    })),
    {
      Icon: Bus,
      text: input.travel.main === "home" ? t("onb.fromHome") : `${t(modeKey(input.travel.main))}, ${t(`trip.${input.travel.tripLength}`)}`,
    },
    ...(input.travel.others.length
      ? [{ Icon: TrainFront, text: t("onb.summaryOthers", { modes: input.travel.others.map((m) => t(modeKey(m))).join(", ") }) }]
      : []),
    { Icon: Lock, text: t(`onb.summaryHealth.${health}`) },
  ];
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {lines.map(({ Icon, text }) => (
        <li key={text} className="flex items-start gap-2.5 rounded-[12px] border border-rule bg-card p-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}
