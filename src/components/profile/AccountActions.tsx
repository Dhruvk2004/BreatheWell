"use client";

import { Trash2 } from "lucide-react";
import { deleteAccount, leaveFamily } from "@/client/actions";
import { translator, type Lang } from "@/i18n/t";
import { ConfirmDialog } from "../form/ConfirmDialog";
import { useGoTo } from "./useGoTo";
import { btn } from "../ui/styles";
import { failureText } from "../ui/failure";

interface LeaveFamilyProps {
  readonly familyName: string;
  readonly dependents: readonly string[];
  readonly disabled: boolean;
  /** The note saying why Leave is disabled, so screen readers hear the reason. */
  readonly describedBy?: string;
  readonly lang: Lang;
}

/** Leave family: the confirm names the children and teens that go too. */
export function LeaveFamily({ familyName, dependents, disabled, describedBy, lang }: LeaveFamilyProps) {
  const t = translator(lang);
  const goTo = useGoTo();
  const run = async () => {
    try {
      await leaveFamily();
      goTo("/onboarding");
      return null;
    } catch (error) {
      return failureText(error, lang, "common.error");
    }
  };
  return (
    <ConfirmDialog
      trigger={t("prof.leave")}
      triggerClassName={`${btn.secondary} ${btn.small} disabled:opacity-60`}
      disabled={disabled}
      triggerDescribedBy={describedBy}
      title={t("prof.leaveTitle", { family: familyName })}
      cancel={t("common.cancel")}
      confirm={t("prof.leaveConfirm")}
      destructive
      onConfirm={run}
    >
      <p className="m-0">{t("prof.leaveBody")}</p>
      <p className="m-0">{dependents.length ? t("prof.leaveDeps", { list: dependents.join(", ") }) : t("prof.leaveNoDeps")}</p>
    </ConfirmDialog>
  );
}

interface DeleteAccountProps {
  readonly disabled: boolean;
  /** Set when the user is the family's only adult: the family is deleted with the account. */
  readonly soloFamily: string | null;
  /** The children and teens erased with the account (named in the confirm). */
  readonly dependents: readonly string[];
  readonly describedBy: string;
  readonly lang: Lang;
}

/** Delete my account: the server erases everything and the Firebase Auth user. */
export function DeleteAccount({ disabled, soloFamily, dependents, describedBy, lang }: DeleteAccountProps) {
  const t = translator(lang);
  const goTo = useGoTo();
  const run = async () => {
    try {
      await deleteAccount();
      goTo("/");
      return null;
    } catch (error) {
      return failureText(error, lang, "common.error");
    }
  };
  return (
    <ConfirmDialog
      trigger={
        <>
          <Trash2 className="size-5" aria-hidden="true" />
          {t("prof.deleteAccount")}
        </>
      }
      triggerClassName={`${btn.secondary} w-max disabled:opacity-60`}
      disabled={disabled}
      triggerDescribedBy={describedBy}
      title={t("prof.deleteTitle")}
      cancel={t("common.cancel")}
      confirm={t("prof.deleteAccount")}
      destructive
      onConfirm={run}
    >
      <p className="m-0">{t("prof.deleteBody")}</p>
      {soloFamily && <p className="m-0 font-bold">{t("prof.deleteFamilyToo", { family: soloFamily })}</p>}
      {dependents.length > 0 && <p className="m-0">{t("prof.leaveDeps", { list: dependents.join(", ") })}</p>}
    </ConfirmDialog>
  );
}
