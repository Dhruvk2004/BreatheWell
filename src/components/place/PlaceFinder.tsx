"use client";

import { MapPin } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { translator, type Lang } from "@/i18n/t";
import { btn, noteNeutral } from "../ui/styles";
import { PlaceSearch } from "./PlaceSearch";
import { useLocate } from "./useLocate";

/**
 * The landing's way to a place (spec 5.1, 10.1): the location note above the button, "Check the
 * air near me", the sample-family link (children) and the city search. Location denied → the note
 * "We'll use the city you pick…" and focus moves to the search; "Use my location" stays available.
 */
export function PlaceFinder({ lang, children }: { lang: Lang; children?: ReactNode }) {
  const t = translator(lang);
  const search = useRef<HTMLInputElement>(null);
  const { state, locate } = useLocate(lang, () => search.current?.focus());
  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <p className="m-0 max-w-[34em] text-sm text-ink-muted">{t("landing.locationNote")}</p>
        {state === "denied" && (
          <p role="status" className={`m-0 ${noteNeutral}`}>
            <MapPin className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <span>{t("landing.denied")}</span>
          </p>
        )}
        <div className="grid gap-3 sm:flex sm:flex-wrap">
          <button type="button" onClick={locate} disabled={state === "locating"} className={`${btn.primary} disabled:opacity-70`}>
            <MapPin className="size-5" aria-hidden="true" />
            {t(state === "denied" ? "landing.useLocation" : state === "locating" ? "landing.locating" : "landing.cta.air")}
          </button>
          {children}
        </div>
      </div>
      <div className="max-w-[26em]">
        <PlaceSearch lang={lang} inputRef={search} />
      </div>
    </div>
  );
}
