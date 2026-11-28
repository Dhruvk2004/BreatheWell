import { Clock } from "lucide-react";
import type { AirSummary } from "@/domain/air/summary";
import { formatWindow } from "@/domain/time/format";
import { translator, type Lang } from "@/i18n/t";

/**
 * "Best time outside today: 2–4 pm · Worst: 6–9 am", "Best time left today" once
 * the morning is past, tomorrow's after 9 pm, or "Best time: not available today".
 */
export function BestLine({ summary, lang }: { summary: AirSummary; lang: Lang }) {
  const t = translator(lang);
  const { best, worst } = summary;
  return (
    <p className="m-0 flex items-start gap-2 border-t border-rule px-4 py-3">
      <Clock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
      {best ? (
        <span>
          {t(`air.best.${summary.windowDay}`)} <strong>{formatWindow(best.start, best.end, lang)}</strong>
          {worst && ` · ${t("air.worst", { window: formatWindow(worst.start, worst.end, lang) })}`}
        </span>
      ) : (
        <span>{t("air.best.none")}</span>
      )}
    </p>
  );
}
