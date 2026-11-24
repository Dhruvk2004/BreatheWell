"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { removeMember } from "@/client/actions";
import { translator, type Lang } from "@/i18n/t";
import { ConfirmDialog } from "../form/ConfirmDialog";
import { btn } from "../ui/styles";
import { failureText } from "../ui/failure";

export interface RemovalCopy {
  readonly uid: string;
  readonly name: string;
  readonly familyName: string;
  /** The children and teens this member added, deleted with them (named in the confirm). */
  readonly dependents: readonly string[];
}

/** The remove confirm used on Today's join card and in Family settings. */
export function RemoveMember({ member, lang, label }: { member: RemovalCopy; lang: Lang; label: string }) {
  const t = translator(lang);
  const router = useRouter();
  const run = async () => {
    try {
      await removeMember(member.uid);
      router.refresh();
      return null;
    } catch (error) {
      return failureText(error, lang, "common.error");
    }
  };
  return (
    <ConfirmDialog
      trigger={t("set.remove")}
      triggerLabel={label}
      triggerClassName={`${btn.secondary} ${btn.small} relative z-[1]`}
      title={t("set.removeTitle", { name: member.name, family: member.familyName })}
      cancel={t("common.cancel")}
      confirm={t("set.remove")}
      destructive
      onConfirm={run}
    >
      <p className="m-0">{t("set.removeBody", { name: member.name })}</p>
      <p className="m-0">
        {member.dependents.length
          ? t("set.removeDeps", { name: member.name, list: member.dependents.join(", ") })
          : t("set.removeNoDeps", { name: member.name })}
      </p>
    </ConfirmDialog>
  );
}

/** "Rahul joined via your code · Remove" (spec 5.3, design 10.8 admin card). */
export function JoinCard({ member, lang }: { member: RemovalCopy; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-brand-tint p-4">
      <p className="m-0 flex items-center gap-2 font-bold">
        <UserPlus className="size-5 text-brand" aria-hidden="true" />
        {t("today.joined", { name: member.name })}
      </p>
      <RemoveMember member={member} lang={lang} label={t("today.removeFor", { name: member.name })} />
    </div>
  );
}
