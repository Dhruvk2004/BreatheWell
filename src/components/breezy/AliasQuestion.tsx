"use client";

import { useState } from "react";
import { translator, type Lang } from "@/i18n/t";
import type { BreezyPerson } from "@/view/breezy";
import { BreezyMark } from "./BreezyMark";
import { PersonChips } from "./WhoIsThisFor";

interface AliasQuestionProps {
  readonly word: string;
  readonly people: readonly BreezyPerson[];
  readonly lang: Lang;
  /** Saves the alias and sends the paused question; false when saving failed. */
  readonly onPick: (forId: string) => Promise<boolean>;
}

/** "Who do you mean by 'Papa'?": asked by code; nothing goes to Gemini until a pick. */
export function AliasQuestion({ word, people, lang, onPick }: AliasQuestionProps) {
  const t = translator(lang);
  const [picked, setPicked] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pick = async (id: string) => {
    setPicked(id);
    const ok = await onPick(id);
    setFailed(!ok);
    if (!ok) setPicked(null);
  };
  return (
    <div className="m-in flex items-start gap-2">
      <BreezyMark />
      <div className="grid gap-2 rounded-[16px] rounded-tl-[4px] bg-ai-tint px-3.5 py-2.5">
        <p className="m-0 font-bold">{t("breezy.alias.ask", { word })}</p>
        <PersonChips people={people} label={t("breezy.alias.ask", { word })} chosen={picked} onPick={pick} disabled={picked !== null} />
        <p className="m-0 text-sm text-ink-muted">{t("breezy.alias.note", { word })}</p>
        {failed && (
          <p role="alert" className="m-0 font-bold text-err">
            {t("breezy.alias.failed")}
          </p>
        )}
      </div>
    </div>
  );
}
