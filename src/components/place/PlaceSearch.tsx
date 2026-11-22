"use client";

import { MapPin, Search } from "lucide-react";
import type { Ref } from "react";
import { suggestionLabel, type PlaceSuggestion } from "@/data/openMeteo/geocode";
import { translator, type Lang } from "@/i18n/t";
import type { ChosenPlace } from "./airHref";
import { usePlaceCombobox } from "./useCombobox";
import type { SearchStatus } from "./usePlaceSearch";

const STATUS_KEY = {
  idle: null,
  loading: "search.loading",
  results: "search.results",
  none: "search.none",
  error: "search.error",
} as const;

/**
 * "Or type your city" (spec 10.1 item 4): an ARIA 1.2 combobox with place suggestions after 3
 * letters, inside a GET form to /air so the field still submits without JavaScript.
 */
interface PlaceSearchProps {
  readonly lang: Lang;
  readonly inputRef?: Ref<HTMLInputElement>;
  /** Picks a place in a bigger form (Create family) instead of opening Air now. */
  readonly onChoose?: (place: ChosenPlace) => void;
  readonly label?: string;
}

export function PlaceSearch({ lang, inputRef, onChoose, label }: PlaceSearchProps) {
  const combo = usePlaceCombobox(lang, onChoose);
  const field = (
    <ComboField combo={combo} prefix={onChoose ? "home" : "place"} named={!onChoose} inputRef={inputRef} label={label} lang={lang} />
  );
  if (onChoose) return <div className="relative grid gap-1">{field}</div>;
  return (
    <form id="place-search" action="/air" method="get" role="search" onSubmit={combo.submit} className="relative grid gap-1">
      {field}
    </form>
  );
}

const FIELD = "flex min-h-12 items-center gap-2 rounded-xs border-[1.5px] border-rule-strong bg-card px-3.5 focus-within:border-brand";
const INPUT = "min-h-11 w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-ink-muted";

interface ComboFieldProps {
  readonly combo: ReturnType<typeof usePlaceCombobox>;
  readonly prefix: string;
  /** Only the Air now search submits the field (name="place"). */
  readonly named: boolean;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly label?: string;
  readonly lang: Lang;
}

function ComboField({ combo, prefix, named, inputRef, label, lang }: ComboFieldProps) {
  const t = translator(lang);
  const { results, status, active, open, choose } = combo;
  const listId = `${prefix}-suggestions`;
  const optionId = (i: number) => `${prefix}-option-${i}`;
  return (
    <>
      <label htmlFor={`${prefix}-input`} className="font-bold">
        {label ?? t("search.label")}
      </label>
      <ComboInput
        combo={combo}
        prefix={prefix}
        named={named}
        inputRef={inputRef}
        listId={listId}
        activeId={open && active >= 0 ? optionId(active) : undefined}
        placeholder={t("search.placeholder")}
      />
      <Suggestions
        results={results}
        active={active}
        open={open}
        choose={choose}
        label={t("search.listLabel")}
        listId={listId}
        optionId={optionId}
      />
      <SearchStatusLine status={status} count={results.length} lang={lang} />
    </>
  );
}

interface ComboInputProps extends Omit<ComboFieldProps, "label" | "lang"> {
  readonly listId: string;
  readonly activeId: string | undefined;
  readonly placeholder: string;
}

function ComboInput({ combo, prefix, named, inputRef, listId, activeId, placeholder }: ComboInputProps) {
  return (
    <span className={FIELD}>
      <Search className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />
      <input
        id={`${prefix}-input`}
        name={named ? "place" : undefined}
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={combo.open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        autoComplete="off"
        placeholder={placeholder}
        value={combo.query}
        onChange={(e) => combo.change(e.target.value)}
        onKeyDown={combo.onKeyDown}
        className={INPUT}
      />
    </span>
  );
}

interface SuggestionsProps {
  readonly results: readonly PlaceSuggestion[];
  readonly active: number;
  readonly open: boolean;
  readonly choose: (s: PlaceSuggestion) => void;
  readonly label: string;
  readonly listId: string;
  readonly optionId: (i: number) => string;
}

function Suggestions({ results, active, open, choose, label, listId, optionId }: SuggestionsProps) {
  return (
    <ul
      id={listId}
      role="listbox"
      aria-label={label}
      hidden={!open}
      className="m-0 list-none overflow-hidden rounded-xs border border-rule bg-card p-0 shadow-raised"
    >
      {results.map((s, i) => (
        <li
          key={s.id}
          id={optionId(i)}
          role="option"
          aria-selected={i === active}
          onClick={() => choose(s)}
          className="flex min-h-12 cursor-pointer items-center gap-2 border-t border-rule px-3.5 first:border-t-0 aria-selected:bg-brand-tint aria-selected:font-bold"
        >
          <MapPin className="size-5 shrink-0 text-brand" aria-hidden="true" />
          <span>{suggestionLabel(s)}</span>
        </li>
      ))}
    </ul>
  );
}

function SearchStatusLine({ status, count, lang }: { status: SearchStatus; count: number; lang: Lang }) {
  const key = STATUS_KEY[status];
  return (
    <p role="status" className="m-0 text-sm text-ink-muted empty:hidden">
      {key ? translator(lang)(key, { count }) : ""}
    </p>
  );
}
