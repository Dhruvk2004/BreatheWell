import { rowLine } from "@/ai/plan/template";
import type { FamilyDay } from "@/domain/family/familyDay";
import type { Mode } from "@/domain/rules/modes";
import { formatWindow, type Lang } from "@/domain/time/format";
import { t } from "@/i18n/t";

/**
 * "Share today's plan" (F23, spec 10.8 item 2c): one bilingual text for the family WhatsApp group,
 * the admin's language first. Code text only (the template line per person), so it carries no
 * health tags, no cigarette values and no air numbers. Null without a plan (no air data).
 */
export interface SharePerson {
  readonly id: string;
  readonly name: string;
  readonly mainMode: Mode;
}

function block(day: FamilyDay, people: readonly SharePerson[], place: string, lang: Lang): string | null {
  const now = day.summary.now;
  if (!now) return null;
  const lines = day.rows.flatMap((row) => {
    const person = people.find((p) => p.id === row.person.id);
    const headline = row.headline;
    if (!person || !headline) return [];
    const line = rowLine(
      { type: headline.activity.type, usual: headline.activity.usual, mainMode: person.mainMode, plan: headline.plan },
      lang,
    );
    return [`${person.name}: ${line}`];
  });
  const best = day.summary.best;
  const parts = [
    t(lang, "share.plan.head", { place, band: t(lang, `band.${now.band}.word`) }),
    ...lines,
    ...(best ? [t(lang, "share.plan.best", { window: formatWindow(best.start, best.end, lang) })] : []),
  ];
  return `${parts.join(" ")} – BreatheWell`;
}

/** The share text in both languages, `first` (the admin's language) on top. */
export function familyShareText(day: FamilyDay, people: readonly SharePerson[], place: string, first: Lang): string | null {
  const order: Lang[] = first === "hi" ? ["hi", "en"] : ["en", "hi"];
  const blocks = order.map((lang) => block(day, people, place, lang));
  return blocks[0] && blocks[1] ? `${blocks[0]}\n\n${blocks[1]}` : null;
}
