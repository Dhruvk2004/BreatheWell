import Link from "next/link";
import { Lock, Pencil } from "lucide-react";
import { formatCode } from "@/domain/family/joinCode";
import { translator, type Lang } from "@/i18n/t";
import type { PersonView, SettingsPage } from "@/view/app";
import { DeleteDependent } from "../dependent/DeleteDependent";
import { homeSetupSummary } from "../family/homeSetup";
import { RemoveMember } from "../today/JoinCard";
import { removalOf } from "../today/removal";
import { btn, h2, noteInfo } from "../ui/styles";
import { DeleteFamily } from "./DeleteFamily";
import { FamilyDetailsForm } from "./FamilyDetailsForm";

interface Props {
  readonly page: SettingsPage;
  /** Join times, formatted on the server ("Joined via code, Fri, 21 Nov, 7:02 pm"). */
  readonly joinedAt: Readonly<Record<string, string>>;
  readonly code: string | null;
  readonly lang: Lang;
}

const LIST = "m-0 grid list-none gap-0 overflow-hidden rounded-[16px] border border-rule bg-card p-0";
const ROW = "flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-3 first:border-t-0";

/** Family settings: everything for the admin; read-only for other adults. */
export function SettingsView({ page, joinedAt, code, lang }: Props) {
  const t = translator(lang);
  const { family } = page;
  const children = family.people.filter((p) => p.kind === "dependent");
  return (
    <div className="mx-auto grid w-full max-w-[40rem] gap-6">
      <h1 className="m-0 text-2xl font-bold">{family.isAdmin ? t("set.title") : family.name}</h1>
      {!family.isAdmin && (
        <p className={`m-0 ${noteInfo}`}>
          <Lock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          {t("set.adminOnly")}
        </p>
      )}
      {family.isAdmin && <FamilyDetailsForm name={family.name} placeName={family.placeName} homeSetup={page.homeSetup} lang={lang} />}
      <Members page={page} joinedAt={joinedAt} lang={lang} />
      <section aria-labelledby="children-h" className="grid gap-2">
        <h2 id="children-h" className={h2}>
          {t("set.children")}
        </h2>
        {children.length === 0 ? (
          <p className="m-0 text-ink-muted">{t("set.noChildren")}</p>
        ) : (
          <ChildrenList people={children} page={page} lang={lang} />
        )}
      </section>
      {!family.isAdmin && page.homeSetup && (
        <section aria-labelledby="home-h" className="grid gap-1">
          <h2 id="home-h" className={h2}>
            {t("set.homeSetup")}
          </h2>
          <p className="m-0">{homeSetupSummary(page.homeSetup, lang)}</p>
        </section>
      )}
      {family.isAdmin && (
        <AdminTail familyName={family.name} code={code} alone={family.people.filter((p) => p.kind === "adult").length === 1} lang={lang} />
      )}
    </div>
  );
}

/** Members with how they joined; the admin can remove anyone but themself. */
function Members({ page, joinedAt, lang }: Omit<Props, "code">) {
  const t = translator(lang);
  const { family } = page;
  const line = (p: PersonView) =>
    [
      t(`age.${p.ageGroup}`),
      p.admin ? t("set.createdFamily") : p.joinedAt ? t("set.joinedVia", { time: joinedAt[p.id] ?? "" }) : null,
      p.onboarded ? null : t("set.settingUp"),
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <section aria-labelledby="members-h" className="grid gap-2">
      <h2 id="members-h" className={h2}>
        {t("set.members")}
      </h2>
      <ul className={LIST}>
        {family.people
          .filter((p) => p.kind === "adult")
          .map((p) => (
            <li key={p.id} className={ROW}>
              <span className="grid">
                <strong>
                  {[p.name, p.id === family.viewerUid ? t("set.you") : "", p.admin ? `· ${t("tag.admin")}` : ""].filter(Boolean).join(" ")}
                </strong>
                <span className="text-sm text-ink-muted">{line(p)}</span>
              </span>
              {family.isAdmin && p.id !== family.viewerUid && (
                <RemoveMember member={removalOf(family, p.id)} lang={lang} label={t("today.removeFor", { name: p.name })} />
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}

/** The Invite row and the Danger zone (admin only). */
function AdminTail({ familyName, code, alone, lang }: { familyName: string; code: string | null; alone: boolean; lang: Lang }) {
  const t = translator(lang);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-rule bg-card p-4">
        <strong>{code ? `${t("set.invite")} · ${formatCode(code)}` : t("set.invite")}</strong>
        <Link href="/family/invite" className={`${btn.secondary} ${btn.small}`}>
          {t("set.openInvite")}
        </Link>
      </div>
      <DeleteFamily familyName={familyName} alone={alone} lang={lang} />
    </>
  );
}

function ChildrenList({ people, page, lang }: { people: readonly PersonView[]; page: SettingsPage; lang: Lang }) {
  const t = translator(lang);
  const { family } = page;
  return (
    <ul className={LIST}>
      {people.map((p) => {
        const canManage = family.isAdmin || p.guardianUid === family.viewerUid;
        return (
          <li key={p.id} className={ROW}>
            <span className="grid">
              <strong>{p.name}</strong>
              <span className="text-sm text-ink-muted">
                {t(`age.${p.ageGroup}`)} · {t("set.addedBy", { name: p.guardianName ?? "" })}
                {!canManage && ` · ${t("set.readOnlyChildren")}`}
              </span>
            </span>
            {canManage && (
              <span className="flex flex-wrap gap-2">
                <Link href={`/dependent/${p.id}`} className={`${btn.secondary} ${btn.small}`}>
                  <Pencil className="size-5" aria-hidden="true" />
                  {t("common.edit")}
                </Link>
                <DeleteDependent id={p.id} name={p.name} lang={lang} compact />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
