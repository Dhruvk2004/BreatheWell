"use client";

import { MapPin } from "lucide-react";
import { useRef } from "react";
import { translator, type Lang } from "@/i18n/t";
import type { ChosenPlace } from "../place/airHref";
import { PlaceSearch } from "../place/PlaceSearch";
import { useLocate } from "../place/useLocate";
import { btn, noteNeutral } from "../ui/styles";

/**
 * Home area: Use my location or search; a preview "Green Park, New Delhi"
 * with no map. The server rounds the coordinates to 2 decimals before storing.
 */
export function HomePicker({
  value,
  onChange,
  lang,
  error,
}: {
  value: ChosenPlace | null;
  onChange: (p: ChosenPlace) => void;
  lang: Lang;
  error?: string | null;
}) {
  const t = translator(lang);
  const search = useRef<HTMLInputElement>(null);
  const focusSearch = () => search.current?.focus();
  // Without a place name (the geocoder failed) the search is the way on; a bare position is never stored.
  const { state, locate } = useLocate(lang, focusSearch, (place) => (place.name ? onChange(place) : focusSearch()));
  return (
    <fieldset className="m-0 grid gap-3 border-0 p-0">
      <legend className="mb-2 p-0 text-lg font-bold">{t("fam.home")}</legend>
      <button type="button" onClick={locate} disabled={state === "locating"} className={`${btn.secondary} w-max disabled:opacity-70`}>
        <MapPin className="size-5" aria-hidden="true" />
        {t(state === "locating" ? "fam.locating" : "fam.useLocation")}
      </button>
      {state === "denied" && (
        <p role="status" className={`m-0 ${noteNeutral}`}>
          {t("fam.homeDenied")}
        </p>
      )}
      <PlaceSearch lang={lang} inputRef={search} onChoose={onChange} />
      <p aria-live="polite" className="m-0 flex items-center gap-2 font-bold empty:hidden">
        {value && <MapPin className="size-5 text-brand" aria-hidden="true" />}
        {value ? t("fam.homeChosen", { place: value.name }) : ""}
      </p>
      {error && !value && <p className="m-0 font-bold text-err">{error}</p>}
      <p className="m-0 text-sm text-ink-muted">{t("fam.homeNote")}</p>
    </fieldset>
  );
}
