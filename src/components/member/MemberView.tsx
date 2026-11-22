import Link from "next/link";
import { ChevronLeft, House, Pencil, Smile } from "lucide-react";
import { formatWindow } from "@/domain/time/format";
import { t as tIn, translator, type Lang } from "@/i18n/t";
import type { ChecklistItem, MemberPage, PersonView } from "@/view/app";
import { NoDataCard, StationNote } from "../air/AirStates";
import { PlanSlot } from "../plan/PlanSlot";
import { formatInstant } from "@/domain/time/instant";
import { btn, h2, noteInfo } from "../ui/styles";
import { PlanItems } from "./PlanItems";
import { PlanSwap } from "./PlanSwap";
import { TickBox } from "./TickBox";

/** "18–59 · English · Admin" or "Child · added by Neha" (design 10.9 header). */
function subtitle(person: PersonView, lang: Lang): string {
  const t = translator(lang);
  if (person.kind === "dependent")
    return t(person.ageGroup === "under13" ? "member.childBy" : "member.teenBy", { name: person.guardianName ?? "" });
  return [
    t(`age.${person.ageGroup}`),
    tIn(person.language === "hi" ? "en" : "hi", "shell.lang.switch"),
    ...(person.admin ? [t("tag.admin")] : []),
  ].join(" · ");
}

/** Member plan (spec 10.9, design 10.9). */
export function MemberView({ page, lang }: { page: MemberPage; lang: Lang }) {
  const t = translator(lang);
  const { person, plan, air } = page;
  return (
    <div className="grid gap-5">
      <Link href="/today" className={`${btn.text} w-max`}>
        <ChevronLeft className="size-5" aria-hidden="true" />
        {t("member.back")}
      </Link>
      <MemberHeader page={page} lang={lang} />
      <section aria-labelledby="plan-h" className="grid gap-3">
        <h2 id="plan-h" className={h2}>
          {t("member.todayPlan")}
        </h2>
        {air.stationNote && <StationNote lang={lang} />}
        <PlanBody page={page} lang={lang} />
      </section>
      {page.swap && plan && (
        <PlanSwap swap={page.swap} forId={plan.person.id} ticked={page.ticked} travel={plan.person.travel} lang={lang} />
      )}
      <Checklist items={page.checklist} person={person} lang={lang} />
      {air.fetchedAt && (
        <PlanSlot
          words={{ ...page.words, pending: false }}
          madeAt={page.words.generatedAt && formatInstant(new Date(page.words.generatedAt), air.timeZone, lang)}
          airAt={formatInstant(new Date(air.fetchedAt), air.timeZone, lang)}
          lang={lang}
        />
      )}
    </div>
  );
}

function MemberHeader({ page, lang }: { page: MemberPage; lang: Lang }) {
  const t = translator(lang);
  const { person } = page;
  return (
    <>
      <header className="grid grid-cols-[3.5em_1fr] items-center gap-3">
        <span
          aria-hidden="true"
          className={`grid size-14 place-items-center rounded-full text-lg font-bold ${person.kind === "dependent" ? "bg-card-2 text-ink" : "bg-brand-tint text-brand"}`}
        >
          {person.initials}
        </span>
        <div>
          <h1 className="m-0 text-2xl font-bold">{t("member.title", { name: person.name })}</h1>
          <p className="m-0 text-ink-muted">{subtitle(person, lang)}</p>
          {page.conditions.length > 0 && (
            <p className="m-0 text-sm">{t("member.health", { list: page.conditions.map((c) => t(`cond.${c}`)).join(", ") })}</p>
          )}
        </div>
      </header>
      {person.kind === "dependent" && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/kid/${person.id}`} className={`${btn.secondary} ${btn.small}`}>
            <Smile className="size-5" aria-hidden="true" />
            {t("kid.open")}
          </Link>
          {page.canEdit && (
            <Link href={`/dependent/${person.id}`} className={`${btn.secondary} ${btn.small}`}>
              <Pencil className="size-5" aria-hidden="true" />
              {t("common.edit")}
            </Link>
          )}
        </div>
      )}
    </>
  );
}

/** Still setting up, no air data, the timed items, or "mostly stays in" with the best window. */
function PlanBody({ page, lang }: { page: MemberPage; lang: Lang }) {
  const t = translator(lang);
  const { person, plan, air } = page;
  if (!person.onboarded) return <p className={`m-0 ${noteInfo}`}>{t("member.settingUp", { name: person.name })}</p>;
  if (!air.day || air.setupVerdict === null) return <NoDataCard lang={lang} retryHref={`/member/${person.id}`} />;
  if (plan && plan.items.length > 0) return <PlanItems plan={plan} ticked={page.ticked} words={page.words.items[person.id]} lang={lang} />;
  const best = air.day.summary.best;
  return (
    <p className={`m-0 ${noteInfo}`}>
      <House className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
      {best
        ? t("member.empty", { name: person.name, window: formatWindow(best.start, best.end, lang) })
        : t("member.emptyNoWindow", { name: person.name })}
    </p>
  );
}

function Checklist({ items, person, lang }: { items: readonly ChecklistItem[]; person: PersonView; lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="check-h" className="grid gap-2">
      <h2 id="check-h" className={h2}>
        {t("member.checklist")}
      </h2>
      {items.length === 0 ? (
        <p className="m-0 text-ink-muted">{t("member.emptyChecklist")}</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((item) => (
            <li key={item.id} className="grid gap-0.5 rounded-[12px] border border-rule bg-card p-3">
              <TickBox target={{ kind: "item", id: item.id }} label={item.text} done={item.done} lang={lang} />
              <span className="text-sm text-ink-muted">
                {t("member.addedBy", { name: item.addedByName })}
                {person.kind === "dependent" && !item.onCard && ` · ${t("member.notOnCard", { name: person.name })}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
