"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createFamily } from "@/client/actions";
import { familyName, type PlaceInput } from "@/domain/family/home";
import type { HomeSetup } from "@/domain/libraries/homeSetup";
import { translator, type Lang } from "@/i18n/t";
import { TextField } from "../form/TextField";
import type { ChosenPlace } from "../place/airHref";
import { btn, h2 } from "../ui/styles";
import { BLANK_HOME, HomeSetupFields } from "./HomeSetupFields";
import { HomePicker } from "./HomePicker";
import { failureText } from "../ui/failure";

/** The place as `/api/family` takes it; the server rounds and grids it. */
export const placeBody = (place: ChosenPlace): PlaceInput => ({
  name: place.name.slice(0, 80),
  lat: place.lat,
  lon: place.lon,
  countryCode: place.countryCode?.toUpperCase() ?? null,
});

function useCreateFamily(lang: Lang) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [home, setHome] = useState<ChosenPlace | null>(null);
  const [setup, setSetup] = useState<HomeSetup>(BLANK_HOME);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOk = familyName.safeParse(name).success;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!nameOk || !home) return;
    setBusy(true);
    try {
      await createFamily({ name: name.trim(), home: placeBody(home), homeSetup: setup });
      router.push("/family/invite");
    } catch (failure) {
      setError(failureText(failure, lang, "common.error", { in_family: "fam.inFamily" }));
      setBusy(false);
    }
  };
  return { name, setName, home, setHome, setup, setSetup, tried, busy, error, nameOk, submit };
}

/** Create family (spec 10.6, 5.2 step 4): name, home area, home set-up → the Invite screen. */
export function CreateFamily({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const form = useCreateFamily(lang);
  return (
    <form onSubmit={form.submit} noValidate className="mx-auto grid w-full max-w-[34rem] gap-5">
      <h1 className="m-0 text-2xl font-bold">{t("fam.title")}</h1>
      <TextField
        id="family-name"
        label={t("fam.name")}
        placeholder={t("fam.namePlaceholder")}
        value={form.name}
        maxLength={40}
        onChange={(e) => form.setName(e.target.value)}
        error={form.tried && !form.nameOk ? t("fam.nameError") : null}
      />
      <HomePicker value={form.home} onChange={form.setHome} lang={lang} error={form.tried ? t("fam.homeMissing") : null} />
      <h2 className={h2}>{t("fam.yourHome")}</h2>
      <HomeSetupFields value={form.setup} onChange={form.setSetup} lang={lang} />
      <p role="alert" className="m-0 font-bold text-err empty:hidden">
        {form.error}
      </p>
      <button type="submit" disabled={form.busy} className={`${btn.primary} disabled:opacity-60`}>
        {form.busy ? t("common.saving") : t("fam.create")}
      </button>
    </form>
  );
}
