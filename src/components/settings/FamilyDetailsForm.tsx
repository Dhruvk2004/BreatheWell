"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { updateFamily } from "@/client/actions";
import { familyName } from "@/domain/family/home";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import { translator, type Lang } from "@/i18n/t";
import { placeBody } from "../family/CreateFamily";
import { HomePicker } from "../family/HomePicker";
import { BLANK_HOME, HomeSetupFields } from "../family/HomeSetupFields";
import { TextField } from "../form/TextField";
import type { ChosenPlace } from "../place/airHref";
import { btn, h2 } from "../ui/styles";
import { failureText } from "../ui/failure";

interface Props {
  readonly name: string;
  readonly placeName: string;
  readonly homeSetup: HomeSetup | null;
  readonly lang: Lang;
}

function useDetails({ name, homeSetup, lang }: Props) {
  const t = translator(lang);
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [home, setHome] = useState<ChosenPlace | null>(null);
  const [setup, setSetup] = useState<HomeSetup>(homeSetup ?? BLANK_HOME);
  const [status, setStatus] = useState("");
  const nameOk = familyName.safeParse(value).success;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!nameOk) return;
    setStatus(t("common.saving"));
    try {
      await updateFamily({ name: value.trim(), homeSetup: setup, ...(home ? { home: placeBody(home) } : {}) });
      setStatus(t("common.saved"));
      router.refresh();
    } catch (error) {
      setStatus(failureText(error, lang, "common.error"));
    }
  };
  return { value, setValue, home, setHome, setup, setSetup, status, nameOk, submit };
}

/** Family settings items 1–3: name, home area (change) and home set-up, saved together. */
export function FamilyDetailsForm(props: Props) {
  const t = translator(props.lang);
  const form = useDetails(props);
  return (
    <form onSubmit={form.submit} noValidate className="grid gap-5">
      <h2 className={h2}>{t("set.details")}</h2>
      <TextField
        id="settings-name"
        label={t("fam.name")}
        value={form.value}
        maxLength={40}
        onChange={(e) => form.setValue(e.target.value)}
        error={form.nameOk ? null : t("fam.nameError")}
      />
      <p className="m-0">{t("fam.homeChosen", { place: form.home?.name ?? props.placeName })}</p>
      <HomePicker value={form.home} onChange={form.setHome} lang={props.lang} />
      <h2 className={h2}>{t("set.homeSetup")}</h2>
      <HomeSetupFields value={form.setup} onChange={form.setSetup} lang={props.lang} />
      <p role="status" className="m-0 font-bold empty:hidden">
        {form.status}
      </p>
      <button type="submit" className={btn.primary}>
        {t("set.save")}
      </button>
    </form>
  );
}
