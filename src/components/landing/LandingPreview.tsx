import { demoPerson } from "@/data/demo/family";
import { translator, type Lang } from "@/i18n/t";
import type { DemoData } from "@/view/demoPage";
import { BandCard } from "../air/BandCard";
import { BestLine } from "../air/BestLine";
import { rowView } from "../demo/rowView";
import { MemberRow } from "../family/MemberRow";

/**
 * The desktop hero's preview: the sample family's recorded smog morning, so
 * the number and chips are real and captioned with their date. Hidden on phones, where the
 * "Answer first" card carries the same idea.
 */
export function LandingPreview({ demo, lang }: { demo: DemoData; lang: Lang }) {
  const t = translator(lang);
  const now = demo.day.summary.now;
  const rows = demo.day.rows.filter((r) => r.group === "extra" || r.person.ageGroup === "under13");
  if (!now) return null;
  return (
    <figure className="m-0 hidden gap-3 md:grid">
      <BandCard lang={lang} band={now.band} aqi={now.aqi} compact>
        <BestLine summary={demo.day.summary} lang={lang} />
      </BandCard>
      <ul className="m-0 list-none overflow-hidden rounded-[16px] border border-rule bg-card p-0">
        {rows.map((plan) => {
          const person = demoPerson(plan.person.id);
          const view = person && rowView(plan, person, "", lang);
          return view ? <MemberRow key={view.id} lang={lang} {...view} /> : null;
        })}
      </ul>
      <figcaption className="text-sm text-ink-muted">{t("landing.previewCaption")}</figcaption>
    </figure>
  );
}
