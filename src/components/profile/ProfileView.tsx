import Link from "next/link";
import { Pencil } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import type { ProfilePage } from "@/view/app";
import { btn, h2 } from "../ui/styles";
import { DeleteAccount, LeaveFamily } from "./AccountActions";
import { SignOutButton } from "./SignOutButton";
import { ProfileEditor } from "./ProfileEditor";

/** Profile settings. */
export function ProfileView({ page, lang }: { page: ProfilePage; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="mx-auto grid w-full max-w-[40rem] gap-6">
      <h1 className="m-0 text-2xl font-bold">{t("prof.title")}</h1>
      <ProfileEditor input={page.input} lang={lang} />
      <section aria-labelledby="pfam-h" className="grid gap-3 rounded-[16px] border border-rule bg-card p-4">
        <h2 id="pfam-h" className={h2}>
          {t("prof.family")}
        </h2>
        {page.familyName ? <FamilyPart page={page} familyName={page.familyName} lang={lang} /> : <NoFamily lang={lang} />}
      </section>
      <section aria-labelledby="del-h" className="grid gap-2">
        <h2 id="del-h" className={h2}>
          {t("prof.deleteAccount")}
        </h2>
        <p id="del-note" className="m-0 text-ink-muted">
          {page.mustStay ? t("prof.leaveAdmin") : t("prof.deleteHint")}
        </p>
        <DeleteAccount
          disabled={page.mustStay}
          soloFamily={page.isAdmin && !page.mustStay ? page.familyName : null}
          dependents={page.dependents.map((d) => d.name)}
          describedBy="del-note"
          lang={lang}
        />
      </section>
      <SignOutButton label={t("prof.signOut")} />
    </div>
  );
}

function NoFamily({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <>
      <p className="m-0">{t("prof.noFamily")}</p>
      <Link href="/onboarding" className={`${btn.secondary} ${btn.small} w-max`}>
        {t("prof.startOrJoin")}
      </Link>
    </>
  );
}

/** "Sharma family · Admin", Leave family (not for the admin), and the children I added. */
function FamilyPart({ page, familyName, lang }: { page: ProfilePage; familyName: string; lang: Lang }) {
  const t = translator(lang);
  const leaveNote = page.mustStay ? t("prof.leaveAdmin") : page.isAdmin ? t("prof.leaveAlone") : null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="grid">
          <strong>{t(page.isAdmin ? "prof.role.admin" : "prof.role.member", { family: familyName })}</strong>
          {leaveNote && (
            <span id="leave-note" className="text-sm text-ink-muted">
              {leaveNote}
            </span>
          )}
        </span>
        <LeaveFamily
          familyName={familyName}
          dependents={page.dependents.map((d) => d.name)}
          disabled={page.isAdmin}
          describedBy={leaveNote ? "leave-note" : undefined}
          lang={lang}
        />
      </div>
      {page.dependents.length > 0 && (
        <div className="grid gap-2">
          <p className="m-0 font-bold">{t("prof.children")}</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {page.dependents.map((d) => (
              <li key={d.id}>
                <Link href={`/dependent/${d.id}`} className={`${btn.secondary} ${btn.small}`}>
                  <Pencil className="size-5" aria-hidden="true" />
                  {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
