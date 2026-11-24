import Link from "next/link";
import { Clock, Info, RefreshCw, Wind } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import { btn, card, h2, noteInfo, noteNeutral } from "../ui/styles";

/** Loading: a static skeleton with words, never a band colour. */
export function BandSkeleton({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <div aria-busy="true" className="overflow-hidden rounded-[16px] border border-rule bg-card shadow-card">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-card-2 p-4">
        <span className="block size-9 rounded-full bg-rule" />
        <span className="grid gap-2">
          <span className="block h-4 w-28 rounded-xs bg-rule" />
          <span className="block h-3 w-20 rounded-xs bg-rule" />
        </span>
        <span className="block size-11 rounded-xs bg-rule" />
      </div>
      <p role="status" className="m-0 px-4 py-3">
        {t("air.loading")}
      </p>
    </div>
  );
}

/** No data, or older than 12 h: a neutral card, no band, no verdicts. */
export function NoDataCard({ lang, retryHref }: { lang: Lang; retryHref: string }) {
  const t = translator(lang);
  return (
    <div className="overflow-hidden rounded-[16px] border border-rule bg-card shadow-card">
      <p className="m-0 grid grid-cols-[auto_1fr] items-center gap-3 bg-card-2 p-4 text-[1.0625em] font-bold">
        <Wind className="size-7 text-ink-muted" aria-hidden="true" />
        {t("air.noData")}
      </p>
      <div className="px-4 py-3">
        <a href={retryHref} className={`${btn.secondary} ${btn.small}`}>
          <RefreshCw className="size-5" aria-hidden="true" />
          {t("air.retry")}
        </a>
      </div>
    </div>
  );
}

/** Tips that are safe whatever the air. */
export function SafeAnyway({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="safe-h" className={card}>
      <h2 id="safe-h" className={h2}>
        {t("air.safe.title")}
      </h2>
      <ul className="m-0 list-disc pl-5 text-[0.9375em]">
        <li>{t("air.safe.inhaler")}</li>
        <li>{t("air.safe.windows")}</li>
      </ul>
    </section>
  );
}

/** "This air reading is from 4:00 am. We'll update it when we can.". */
export function OldDataNote({ time, lang }: { time: string; lang: Lang }) {
  return (
    <p className={`m-0 ${noteNeutral}`}>
      <Clock className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden="true" />
      <span>{translator(lang)("air.old", { time })}</span>
    </p>
  );
}

/** Delhi NCR on every verdict screen. */
export function StationNote({ lang }: { lang: Lang }) {
  return (
    <p className={`m-0 ${noteInfo}`}>
      <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
      <span>{translator(lang)("air.station")}</span>
    </p>
  );
}

/** Air now without a place in the URL, or over the rate limit: back to the city search. */
export function PickPlace({ lang, message }: { lang: Lang; message: "air.pick" | "air.limited" }) {
  const t = translator(lang);
  return (
    <div className="grid gap-4">
      <h1 className="m-0 text-2xl font-bold">{t("air.title")}</h1>
      <p className="m-0">{t(message)}</p>
      <Link href="/#place-search" className={`${btn.primary} w-max`}>
        {t("air.choose")}
      </Link>
    </div>
  );
}
