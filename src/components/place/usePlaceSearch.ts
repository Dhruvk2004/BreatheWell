"use client";

import { useEffect, useState } from "react";
import { MIN_SEARCH_LENGTH, searchPlaces, type PlaceSuggestion } from "@/data/openMeteo/geocode";
import type { Lang } from "@/domain/time/format";

/** What the live region says about the suggestions. */
export type SearchStatus = "idle" | "loading" | "results" | "none" | "error";

const DEBOUNCE_MS = 250;

/**
 * City search suggestions from Open-Meteo geocoding (F1), after 3 letters, debounced. The browser
 * calls Open-Meteo directly (CSP `connect-src`); only the typed text is sent.
 */
export function usePlaceSearch(query: string, lang: Lang) {
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const short = query.trim().length < MIN_SEARCH_LENGTH;
  useEffect(() => {
    if (short) return;
    let live = true;
    const timer = setTimeout(async () => {
      setStatus("loading");
      const found = await searchPlaces(query, lang);
      if (!live) return;
      setResults(found.ok ? found.value : []);
      setStatus(found.ok ? (found.value.length ? "results" : "none") : "error");
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, lang, short]);
  return short ? { results: [], status: "idle" as const } : { results, status };
}
