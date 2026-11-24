"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { suggestionLabel, type PlaceSuggestion } from "@/data/openMeteo/suggestion";
import type { Lang } from "@/i18n/t";
import { airHref, type ChosenPlace } from "./airHref";
import { usePlaceSearch } from "./usePlaceSearch";

/**
 * Arrow keys move through the suggestions (and reopen the list), Enter opens the active one (else
 * the first), Escape closes the list (ARIA APG combobox); typing also reopens it.
 */
function useActive(results: readonly PlaceSuggestion[], choose: (s: PlaceSuggestion) => void, setClosed: (closed: boolean) => void) {
  const [active, setActive] = useState(-1);
  const step = (next: (a: number) => number) => {
    setClosed(false);
    setActive(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    const moves: Record<string, () => void> = {
      ArrowDown: () => step((a) => (a + 1) % results.length),
      ArrowUp: () => step((a) => (a <= 0 ? results.length - 1 : a - 1)),
      Enter: () => choose(results[Math.max(active, 0)]),
      Escape: () => {
        setActive(-1);
        setClosed(true);
      },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };
  return { active: Math.min(active, results.length - 1), onKeyDown };
}

/** The city search's state: the typed text, the suggestions, the active option and what Enter or submit opens. */
export function usePlaceCombobox(lang: Lang, onChoose?: (place: ChosenPlace) => void) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState(false);
  const { results, status } = usePlaceSearch(query, lang);
  const choose = (s: PlaceSuggestion) => {
    const place = { name: suggestionLabel(s), lat: s.lat, lon: s.lon, countryCode: s.countryCode };
    if (onChoose) {
      setClosed(true);
      setQuery(place.name);
      onChoose(place);
    } else router.push(airHref(place));
  };
  const { active, onKeyDown } = useActive(results, choose, setClosed);
  const change = (text: string) => {
    setQuery(text);
    setClosed(false);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (results.length) choose(results[0]);
  };
  return { query, change, results, status, active, open: results.length > 0 && !closed, onKeyDown, submit, choose };
}
