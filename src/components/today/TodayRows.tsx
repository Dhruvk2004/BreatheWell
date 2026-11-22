import Link from "next/link";
import { Smile } from "lucide-react";
import type { PersonPlan } from "@/domain/family/people";
import type { Verdict } from "@/domain/rules/verdict";
import { translator, type Lang } from "@/i18n/t";
import type { FamilyView, PersonView } from "@/view/app";
import { rowView } from "../demo/rowView";
import { MemberRow } from "../family/MemberRow";
import { FadeText } from "../plan/FadeText";
import { btn } from "../ui/styles";
import { RemindButton } from "./RemindButton";

interface TodayRowsProps {
  readonly family: FamilyView;
  readonly rows: readonly PersonPlan[];
  /** Gemini's row lines by person id, where they passed the checks; others keep the template line. */
  readonly lines: Readonly<Record<string, string>>;
  readonly setupVerdict: Verdict | null;
  readonly appOrigin: string;
  readonly lang: Lang;
}

const asRowPerson = (p: PersonView) => ({ ...p, travel: { main: p.mainMode } });

/**
 * Today's family rows (spec 10.8 item 2): the rules' rows in order (me, extra care, adults,
 * dependents), each a link to the member plan; dependents get Kid card; members still setting up
 * read "… is still setting up · Remind" with the careful chip.
 */
export function TodayRows({ family, rows, lines, setupVerdict, appOrigin, lang }: TodayRowsProps) {
  const t = translator(lang);
  const settingUp = family.people.filter((p) => p.kind === "adult" && !p.onboarded);
  return (
    <ul className="m-0 list-none overflow-hidden rounded-[16px] border border-rule bg-card p-0 md:grid md:grid-cols-2 md:items-start md:gap-3 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
      {rows.map((plan) => (
        <PlanRow key={plan.person.id} plan={plan} family={family} line={lines[plan.person.id]} lang={lang} />
      ))}
      {setupVerdict &&
        settingUp.map((p) => (
          <MemberRow
            key={p.id}
            tile
            lang={lang}
            initials={p.initials}
            name={p.name}
            tags={p.id === family.viewerUid ? [{ label: t("tag.you") }] : []}
            verdict={setupVerdict}
            line={t("today.settingUp", { name: p.name })}
            action={p.id === family.viewerUid ? undefined : <RemindButton name={p.name} appOrigin={appOrigin} lang={lang} />}
          />
        ))}
    </ul>
  );
}

/** One planned person: the row links to the member plan; a dependent also gets Kid card. */
function PlanRow({ plan, family, line, lang }: { plan: PersonPlan; family: FamilyView; line?: string; lang: Lang }) {
  const t = translator(lang);
  const person = family.people.find((p) => p.id === plan.person.id);
  const view = person ? rowView(plan, asRowPerson(person), family.viewerUid, lang) : null;
  if (!view) return null;
  const kid = view.dependent && (
    <Link
      href={`/kid/${view.id}`}
      aria-label={t("kid.openFor", { name: view.name })}
      className={`${btn.secondary} ${btn.small} relative z-[1] w-max`}
    >
      <Smile className="size-5" aria-hidden="true" />
      {t("kid.open")}
    </Link>
  );
  return (
    <MemberRow
      lang={lang}
      tile
      {...view}
      line={<FadeText text={line ?? view.line} />}
      href={`/member/${view.id}`}
      linkLabel={t("today.openPlan", { name: view.name })}
      action={kid || undefined}
    />
  );
}
