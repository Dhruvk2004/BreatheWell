import { rowLine, tomorrowLine } from "@/ai/plan/template";
import type { PersonPlan } from "@/domain/family/people";
import type { Mode } from "@/domain/rules/modes";
import { t as tr, type Lang } from "@/i18n/t";
import { VerdictChip } from "../air/VerdictChip";
import { ListenButton } from "../ui/ListenButton";

/**
 * "View as Dadaji" (design 10.3): the viewer's own card first, one instruction and one better
 * time, and a Listen button. The demo renders it inside the viewer's language and text size.
 */
export function ViewerCard({ plan, name, mainMode, lang }: { plan: PersonPlan; name: string; mainMode: Mode; lang: Lang }) {
  const { headline } = plan;
  if (!headline) return null;
  const line = rowLine({ type: headline.activity.type, usual: headline.activity.usual, mainMode, plan: headline.plan }, lang);
  const inhaler = headline.plan.notes.includes("keep_inhaler") ? tr(lang, "note.keep_inhaler") : "";
  const later = tomorrowLine(headline.plan, lang);
  const spoken = [line, inhaler, later].filter(Boolean).join(" ");
  return (
    <section aria-labelledby="viewer-h" className="grid gap-3 rounded-[16px] border-2 border-brand bg-card p-4">
      <h2 id="viewer-h" className="m-0 text-[1.2em] font-bold">
        {tr(lang, "demo.hello", { name })}
      </h2>
      <VerdictChip verdict={headline.plan.verdictAtUsual} lang={lang} />
      <p className="m-0 font-bold">
        {line} {inhaler}
      </p>
      {later && <p className="m-0 text-[0.875em]">{later}</p>}
      <ListenButton text={spoken} lang={lang} label={tr(lang, "listen.label", { text: line })} />
    </section>
  );
}
