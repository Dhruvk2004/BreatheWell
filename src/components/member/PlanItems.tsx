import { rowLine, tomorrowLine } from "@/ai/plan/template";
import type { PersonPlan, PlannedActivity } from "@/domain/family/people";
import { formatTime, parseHhMm } from "@/domain/time/format";
import { activityKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import type { Words } from "@/view/app";
import { VerdictChip } from "../air/VerdictChip";
import { WhyPanel } from "../air/WhyPanel";
import { ListenButton } from "../ui/ListenButton";
import { FadeText } from "../plan/FadeText";
import { TickBox } from "./TickBox";

/** The "Why?" fact for a change: enclosed travel for a switch, the morning inversion for a moved time. */
export function factFor(item: PlannedActivity): string | null {
  if (item.plan.suggestion === "switch_mode") return "metro_exposure";
  if (item.plan.suggestion === "move_time" || item.plan.suggestion === "indoor") return "morning_inversion";
  return null;
}

/** Gemini's "why" only when it was written for the fact this panel shows; otherwise the fact's own text. */
export const pictureFor = (words: Words | undefined, factId: string): string | undefined =>
  words?.why && words.factId === factId ? words.why : undefined;

interface PlanItemsProps {
  readonly plan: PersonPlan;
  readonly ticked: readonly string[];
  /** Gemini's words by activity id, where they passed the checks; others keep the template. */
  readonly words?: Readonly<Record<string, Words>>;
  readonly lang: Lang;
}

/**
 * Today's plan (spec 10.9 item 2): timed items in time order, each with its chip, Do this (the
 * plan's words or the template line), Why? in three levels, Listen and the done tick.
 */
export function PlanItems({ plan, ticked, words = {}, lang }: PlanItemsProps) {
  const t = translator(lang);
  const items = [...plan.items].sort((a, b) => a.activity.usual.localeCompare(b.activity.usual));
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {items.map((item) => {
        const { hour, minute } = parseHhMm(item.activity.usual);
        const label = t(activityKey(item.activity.type));
        const gemini = words[item.activity.id];
        const doThis =
          gemini?.doThis ??
          rowLine({ type: item.activity.type, usual: item.activity.usual, mainMode: plan.person.travel.main, plan: item.plan }, lang);
        const later = tomorrowLine(item.plan, lang);
        const fact = factFor(item);
        return (
          <li key={item.activity.id} className="grid gap-2 rounded-[16px] border border-rule bg-card p-4">
            <p className="m-0 text-sm font-bold text-ink-muted">{formatTime(hour, minute, lang)}</p>
            <h3 className="m-0 text-lg font-bold">{label}</h3>
            <VerdictChip verdict={item.plan.verdictAtUsual} lang={lang} />
            <p className="m-0 min-h-[3lh] text-lg [html[data-text=lg]_&]:min-h-[4lh] [html[data-text=xl]_&]:min-h-[6lh]">
              <FadeText text={doThis} />
              {later && ` ${later}`}
            </p>
            {fact && <WhyPanel lang={lang} factId={fact} doThis={doThis} picture={pictureFor(gemini, fact)} />}
            <div className="flex flex-wrap items-center gap-3">
              <ListenButton text={later ? `${doThis} ${later}` : doThis} lang={lang} label={t("listen.label", { text: label })} />
              <TickBox
                target={{ kind: "plan", forId: plan.person.id, key: item.activity.id }}
                label={t("member.tick", { activity: label })}
                done={ticked.includes(item.activity.id)}
                lang={lang}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
