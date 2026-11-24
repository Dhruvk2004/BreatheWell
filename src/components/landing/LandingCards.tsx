import { Clock, House, MapPin, TrainFront, Wind } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import type { DemoData } from "@/view/demoPage";
import { VerdictChip } from "../air/VerdictChip";
import { demoPerson } from "@/data/demo/family";
import { aqiBarHeight, BAND_BG } from "../ui/bandStyle";
import { card, h2, noteNeutral } from "../ui/styles";

const HOW = [
  { key: "landing.how.routines", Icon: Clock },
  { key: "landing.how.home", Icon: House },
  { key: "landing.how.alternatives", Icon: TrainFront },
  { key: "landing.how.tailored", Icon: MapPin },
] as const;

/** "How BreatheWell works" in the brief's own words, with what the AI assistant writes. */
export function HowItWorks({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="how-h" className={card}>
      <h2 id="how-h" className={h2}>
        {t("landing.how.title")}
      </h2>
      <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-4 md:gap-4">
        {HOW.map(({ key, Icon }) => (
          <li key={key} className="grid grid-cols-[1.25em_1fr] items-start gap-2.5">
            <Icon className="mt-0.5 size-5 text-brand" aria-hidden="true" />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
      <p className={`m-0 ${noteNeutral}`}>
        <Wind className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden="true" />
        <span>{t("landing.how.ai")}</span>
      </p>
    </section>
  );
}

/** The three cards, drawn from the recorded smog morning so every chip and bar is real. */
export function LandingCards({ demo, lang }: { demo: DemoData; lang: Lang }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AnswerCard demo={demo} lang={lang} />
      <BestCard demo={demo} lang={lang} />
      <WhyCard lang={lang} />
    </div>
  );
}

function AnswerCard({ demo, lang }: { demo: DemoData; lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="answer-h" className={card}>
      <h2 id="answer-h" className={h2}>
        {t("landing.answer.title")}
      </h2>
      <p className="m-0 text-[0.9375em] text-ink-muted">{t("landing.answer.body")}</p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {demo.day.rows.slice(0, 3).map((row) => (
          <li key={row.person.id} className="flex items-center justify-between gap-2">
            <span>{demoPerson(row.person.id)?.name[lang]}</span>
            {row.headline && <VerdictChip verdict={row.headline.plan.verdictAtUsual} lang={lang} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BestCard({ demo, lang }: { demo: DemoData; lang: Lang }) {
  const t = translator(lang);
  const hours = demo.day.summary.today.slice(6, 22);
  return (
    <section aria-labelledby="best-h" className={card}>
      <h2 id="best-h" className={h2}>
        {t("landing.best.title")}
      </h2>
      <div className="grid h-10 grid-cols-16 items-end gap-0.5" aria-hidden="true">
        {hours.map((p, i) => (
          <i key={i} className={`block rounded-t-[2px] ${p ? BAND_BG[p.band] : ""}`} style={{ height: p ? aqiBarHeight(p.aqi) : 0 }} />
        ))}
      </div>
      <p className="m-0 text-[0.9375em]">{t("landing.best.body")}</p>
    </section>
  );
}

function WhyCard({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="why-h" className={card}>
      <h2 id="why-h" className={h2}>
        {t("landing.why.title")}
      </h2>
      <ol className="m-0 grid list-decimal gap-2 pl-5 text-[0.9375em]">
        <li>{t("landing.why.do")}</li>
        <li>{t("landing.why.picture")}</li>
        <li>{t("landing.why.numbers")}</li>
      </ol>
    </section>
  );
}
