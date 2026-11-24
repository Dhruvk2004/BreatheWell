import { rowLine } from "@/ai/plan/template";
import type { AgeGroup } from "@/domain/rules/groups";
import type { Mode } from "@/domain/rules/modes";
import type { PersonPlan } from "@/domain/family/people";
import type { Verdict } from "@/domain/rules/verdict";
import { translator, type Lang } from "@/i18n/t";

/** What a family row shows, from the rules and the template. */
export interface RowView {
  readonly id: string;
  readonly initials: string;
  readonly name: string;
  readonly tags: { label: string; outlined?: boolean }[];
  readonly verdict: Verdict;
  readonly line: string;
  readonly me: boolean;
  readonly dependent: boolean;
}

/** Who a row is for: a demo person (names in both languages) or a family member or dependent. */
export interface RowPerson {
  readonly id: string;
  readonly initials: string;
  readonly name: string | Readonly<Record<Lang, string>>;
  readonly admin: boolean;
  readonly kind: "adult" | "dependent";
  readonly ageGroup: AgeGroup;
  readonly travel: { readonly main: Mode };
}

/** Tags: You, Admin, Extra care (outlined, neutral), Child, Teen. Never a health condition's name. */
function tagsFor(plan: PersonPlan, person: RowPerson, me: boolean, lang: Lang): RowView["tags"] {
  const t = translator(lang);
  const tags: RowView["tags"] = [];
  if (me) tags.push({ label: t("tag.you") });
  if (person.admin) tags.push({ label: t("tag.admin") });
  if (plan.group === "extra") tags.push({ label: t("tag.extra"), outlined: true });
  if (person.kind === "dependent") tags.push({ label: t(person.ageGroup === "under13" ? "tag.child" : "tag.teen") });
  return tags;
}

/** The row for one person, or null when no activity has a verdict (no chip without air data). */
export function rowView(plan: PersonPlan, person: RowPerson, viewerId: string, lang: Lang): RowView | null {
  const { headline } = plan;
  if (!headline) return null;
  const me = person.id === viewerId;
  return {
    id: person.id,
    initials: person.initials,
    name: typeof person.name === "string" ? person.name : person.name[lang],
    tags: tagsFor(plan, person, me, lang),
    verdict: headline.plan.verdictAtUsual,
    line: rowLine(
      { type: headline.activity.type, usual: headline.activity.usual, mainMode: person.travel.main, plan: headline.plan },
      lang,
    ),
    me,
    dependent: person.kind === "dependent",
  };
}
