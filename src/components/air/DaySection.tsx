import type { DayOutlook } from "@/domain/air/outlook";
import { translator, type Lang } from "@/i18n/t";
import { h2 } from "../ui/styles";
import { DayStrip } from "./DayStrip";

/** "Next 5 days · Forecast": the heading and the day strip, shared by Air now and the demo. */
export function DaySection({
  days,
  lang,
  headingId,
  showBest,
}: {
  days: readonly DayOutlook[];
  lang: Lang;
  headingId: string;
  showBest?: boolean;
}) {
  const t = translator(lang);
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h2 id={headingId} className={h2}>
        {t("air.days.title")} <span className="text-sm font-normal text-ink-muted">· {t("air.days.forecast")}</span>
      </h2>
      <DayStrip days={days} lang={lang} showBest={showBest} />
    </section>
  );
}
