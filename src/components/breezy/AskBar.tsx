"use client";

import { SendHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { MAX_QUESTION } from "@/domain/breezy/question";
import { translator, type Lang } from "@/i18n/t";

/** The question box: at most 300 characters with a counter, Send, and a language hint. */
export function AskBar({ lang, busy, onSend }: { lang: Lang; busy: boolean; onSend: (text: string) => void }) {
  const t = translator(lang);
  const [text, setText] = useState("");
  const hintId = useId();
  const inputId = useId();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
  };
  return (
    <form onSubmit={submit} className="grid gap-1">
      <label htmlFor={inputId} className="sr-only">
        {t("breezy.inputLabel")}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={inputId}
          value={text}
          maxLength={MAX_QUESTION}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("breezy.placeholder")}
          aria-describedby={hintId}
          className="min-h-12 flex-1 resize-y rounded-sm border-[1.5px] border-rule-strong bg-card px-3 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-sm bg-brand px-3 font-bold text-on-brand disabled:opacity-60"
        >
          <SendHorizontal className="size-5" aria-hidden="true" />
          {t("breezy.send")}
        </button>
      </div>
      <Hint id={hintId} lang={lang} count={[...text].length} />
    </form>
  );
}

/** The language hint and the 300-character counter (read out politely as it changes). */
function Hint({ id, lang, count }: { id: string; lang: Lang; count: number }) {
  const t = translator(lang);
  return (
    <p id={id} className="m-0 flex justify-between gap-2 text-sm text-ink-muted">
      <span>{t("breezy.langHint")}</span>
      <span>{t("breezy.counter", { count })}</span>
    </p>
  );
}
