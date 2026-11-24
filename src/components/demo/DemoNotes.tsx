import { Clock, OctagonAlert, Users } from "lucide-react";
import { formatInstant } from "@/domain/time/instant";
import { translator, type Lang } from "@/i18n/t";
import type { DemoData } from "@/view/demoPage";
import { noteNeutral } from "../ui/styles";

/** "Sample family. Sign in to make your own." Persistent, not dismissible. */
export function DemoBanner({ lang }: { lang: Lang }) {
  return (
    <p className="m-0 flex items-center gap-2 rounded-sm bg-[var(--color-inverse-bg)] px-4 py-2.5 text-[0.9375em] font-bold text-[var(--color-on-inverse)]">
      <Users className="size-5 shrink-0" aria-hidden="true" />
      {translator(lang)("demo.banner")}
    </p>
  );
}

/** Long date for the recorded day: "18 Nov 2024" / "18 नवंबर 2024". */
const longDate = (date: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === "en" ? "en-IN" : "hi-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

/** Which air the demo shows: the recorded day and its clock, live air, or the saved snapshot. */
export function ScenarioNote({ data, lang }: { data: DemoData; lang: Lang }) {
  const t = translator(lang);
  const time = formatInstant(data.clock.now, data.clock.timeZone, lang);
  const date = data.recordedDate ? longDate(data.recordedDate, lang) : "";
  const lines = {
    recorded: [t("demo.recorded", { time }), t("demo.recordedSource", { date })],
    live: [t("demo.live", { time }), t("demo.liveNoAi")],
    fallback: [t("demo.fallback", { date, time }), t("demo.liveNoAi")],
  }[data.source];
  return (
    <p className={`m-0 ${noteNeutral}`}>
      <Clock className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden="true" />
      <span>
        {lines[0]}
        <span className="block text-sm text-ink-muted">{lines[1]}</span>
      </span>
    </p>
  );
}

/** Severe day: GRAP and indoor-first plans (spec 8.3 override 2, 3 "Severe-day mode"). */
export function SevereNote({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <p className="m-0 flex items-start gap-2.5 rounded-sm border-2 border-ink bg-card px-3.5 py-3 text-[0.9375em]">
      <OctagonAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>
        <b>{t("demo.severe.title")}</b> {t("note.schools_may_close")} {t("demo.severe.grap")}
      </span>
    </p>
  );
}
