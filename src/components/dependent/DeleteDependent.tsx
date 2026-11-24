"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteDependent } from "@/client/actions";
import { translator, type Lang } from "@/i18n/t";
import { ConfirmDialog } from "../form/ConfirmDialog";
import { btn } from "../ui/styles";
import { failureText } from "../ui/failure";

/** Delete a child's profile: everything about them is erased at once, after a confirm. */
export function DeleteDependent({ id, name, lang, compact = false }: { id: string; name: string; lang: Lang; compact?: boolean }) {
  const t = translator(lang);
  const router = useRouter();
  const run = async () => {
    try {
      await deleteDependent(id);
      router.push("/today");
      router.refresh();
      return null;
    } catch (error) {
      return failureText(error, lang, "common.error");
    }
  };
  const dialog = (
    <ConfirmDialog
      trigger={
        <>
          <Trash2 className="size-5" aria-hidden="true" />
          {t("dep.delete", { name })}
        </>
      }
      triggerClassName={`${btn.secondary} ${compact ? btn.small : ""} w-max`}
      title={t("dep.deleteTitle", { name })}
      cancel={t("common.cancel")}
      confirm={t("dep.deleteConfirm")}
      destructive
      onConfirm={run}
    >
      <p className="m-0">{t("dep.deleteHint", { name })}</p>
    </ConfirmDialog>
  );
  if (compact) return dialog;
  return (
    <div className="grid gap-2 border-t border-rule pt-4">
      <p className="m-0 text-sm text-ink-muted">{t("dep.deleteHint", { name })}</p>
      {dialog}
    </div>
  );
}
