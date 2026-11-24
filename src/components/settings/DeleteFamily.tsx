"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteFamily } from "@/client/actions";
import { translator, type Lang } from "@/i18n/t";
import { ConfirmDialog } from "../form/ConfirmDialog";
import { useGoTo } from "../profile/useGoTo";
import { btn } from "../ui/styles";
import { failureText } from "../ui/failure";

/** Danger zone: only when the admin is alone; typed confirmation of the family name. */
export function DeleteFamily({ familyName, alone, lang }: { familyName: string; alone: boolean; lang: Lang }) {
  const t = translator(lang);
  const [typed, setTyped] = useState("");
  const goTo = useGoTo();
  const run = async () => {
    try {
      await deleteFamily(typed);
      goTo("/onboarding");
      return null;
    } catch (error) {
      return failureText(error, lang, "common.error", { name_mismatch: "set.nameMismatch" });
    }
  };
  return (
    <section aria-labelledby="danger-h" className="grid gap-2 rounded-[16px] border-2 border-ink p-4">
      <h2 id="danger-h" className="m-0 text-lg font-bold">
        {t("set.danger")}
      </h2>
      <p className="m-0">{t("set.dangerBody")}</p>
      <ConfirmDialog
        trigger={<TrashLabel text={t("set.deleteFamily")} />}
        triggerClassName={`${btn.secondary} w-max disabled:opacity-60`}
        disabled={!alone}
        title={t("set.deleteFamilyTitle", { family: familyName })}
        cancel={t("common.cancel")}
        confirm={t("set.deleteFamily")}
        destructive
        canConfirm={typed.trim().toLocaleLowerCase() === familyName.trim().toLocaleLowerCase()}
        onConfirm={run}
      >
        <p className="m-0">{t("set.deleteFamilyBody")}</p>
        <TypedName value={typed} onChange={setTyped} label={t("set.typeName")} />
      </ConfirmDialog>
    </section>
  );
}

function TypedName({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <>
      <label htmlFor="confirm-family" className="font-bold">
        {label}
      </label>
      <input
        id="confirm-family"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="min-h-12 rounded-xs border-[1.5px] border-rule-strong bg-card px-3.5"
      />
    </>
  );
}

const TrashLabel = ({ text }: { text: string }) => (
  <>
    <Trash2 className="size-5" aria-hidden="true" />
    {text}
  </>
);
