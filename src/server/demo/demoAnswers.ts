import type { BreezyCard } from "@/domain/breezy/answer";
import { bestCardTime } from "@/domain/breezy/cardTime";
import { bandRank } from "@/domain/air/bands";
import { DAY_FIRST_HOUR } from "@/domain/air/windows";
import { formatHour, formatWindow, type Lang } from "@/domain/time/format";
import { t, translator } from "@/i18n/t";
import { weekdayKey } from "@/i18n/labels";
import type { DemoData } from "@/view/demoPage";

/**
 * The demo chips' code answers (design 10.10 demo, "Simple answer"): every time and day comes
 * from the rules and the outlook, the words from i18n. Shown only when no Gemini answer is stored.
 */
interface CodeAnswer {
  readonly text: string;
  readonly cards: readonly BreezyCard[];
}

const hhmm = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

/** "Plan Dadaji's temple visit": the best non-Avoid hour today (Light, 30 min), as an add_to_plan card. */
export function templeAnswer(data: DemoData, lang: Lang): CodeAnswer {
  const tr = translator(lang);
  const row = data.day.rows.find((r) => r.person.id === "dadaji");
  const { summary } = data.day;
  const ctx = { month: Number(summary.date.slice(5, 7)), region: "igp" as const, hasStation: false };
  const best = row
    ? bestCardTime({
        index: summary.index,
        group: row.group,
        ctx,
        activity: "temple_errand",
        mode: row.person.travel.main,
        date: summary.date,
        hour: DAY_FIRST_HOUR,
        fromHour: summary.hour + 1,
      })
    : null;
  if (!best) return { text: tr("breezy.demo.temple.none"), cards: [] };
  const time = formatHour(best.hour, lang);
  const card: BreezyCard = {
    title: tr("breezy.demo.temple.title", { time }),
    forId: "dadaji",
    date: "today",
    time: hhmm(best.hour),
    activity: "temple_errand",
    verdict: best.verdict,
    why: "",
    factId: "afternoon_mixing",
    action: "add_to_plan",
    item: {
      en: t("en", "breezy.demo.temple.item", { time: formatHour(best.hour, "en") }),
      hi: t("hi", "breezy.demo.temple.item", { time: formatHour(best.hour, "hi") }),
    },
    onCard: true,
  };
  return { text: tr("breezy.demo.temple.best", { time, day: tr("breezy.day.today") }), cards: [card] };
}

/** "Which day is best for the park?": the outlook day with the mildest worst band and a window. */
export function parkAnswer(data: DemoData, lang: Lang): CodeAnswer {
  const tr = translator(lang);
  const days = data.day.summary.outlook.filter((d) => d.best !== null);
  const best = [...days].sort((a, b) => bandRank(a.worstBand) - bandRank(b.worstBand))[0];
  if (!best?.best) return { text: tr("breezy.demo.parkNone"), cards: [] };
  const window = formatWindow(best.best.start, best.best.end, lang);
  return { text: tr("breezy.demo.park", { day: tr(weekdayKey(best.weekday)), window }), cards: [] };
}
