import Link from "next/link";
import { Smile } from "lucide-react";
import { demoPerson } from "@/data/demo/family";
import type { PersonPlan } from "@/domain/family/people";
import { translator, type Lang } from "@/i18n/t";
import { demoHref, type DemoQuery } from "@/data/demo/query";
import { MemberRow } from "../family/MemberRow";
import { btn } from "../ui/styles";
import { rowView } from "./rowView";

/** The Sharma family's rows: me first, extra care, other adults, then Aarav and Riya with Kid card. */
export function FamilyRows({
  rows,
  query,
  lines = {},
  lang,
}: {
  rows: readonly PersonPlan[];
  query: DemoQuery;
  /** The stored plan's row lines (6 am, recorded scenarios); others keep the template line. */
  lines?: Readonly<Record<string, string>>;
  lang: Lang;
}) {
  const t = translator(lang);
  return (
    <ul className="m-0 list-none overflow-hidden rounded-[16px] border border-rule bg-card p-0">
      {rows.map((plan) => {
        const person = demoPerson(plan.person.id);
        const view = person ? rowView(plan, person, query.view, lang) : null;
        if (!person || !view) return null;
        const kid = view.dependent && (
          <Link
            href={demoHref(query, `/demo/kid/${view.id}`)}
            aria-label={t("kid.openFor", { name: view.name })}
            className={`${btn.secondary} ${btn.small} relative z-[1] w-max`}
          >
            <Smile className="size-5" aria-hidden="true" />
            {t("kid.open")}
          </Link>
        );
        return <MemberRow key={view.id} lang={lang} {...view} line={lines[view.id] ?? view.line} action={kid || undefined} />;
      })}
    </ul>
  );
}
