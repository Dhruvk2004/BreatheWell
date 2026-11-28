"use client";

import Link from "next/link";
import { Info, Lock, Wind } from "lucide-react";
import { useState } from "react";
import { translator } from "@/i18n/t";
import type { BreezyDemoPage, DemoChip } from "@/view/breezy";
import { DemoBanner } from "../demo/DemoNotes";
import { btn } from "../ui/styles";
import { ReplyBubble, UserBubble } from "./Bubbles";
import { BreezyHeader } from "./BreezyHeader";
import { PromptChips } from "./PromptChips";
import { SuggestionCard } from "./SuggestionCard";

/**
 * Breezy's public demo: chips only, never free typing, so no
 * visitor text reaches Gemini. Answers are stored Gemini words or the code's Simple
 * answer, each labelled; cards show what they would do and write nothing.
 */
export function BreezyDemo({ page }: { page: BreezyDemoPage }) {
  const { lang } = page;
  const t = translator(lang);
  const [asked, setAsked] = useState<readonly DemoChip[]>([]);
  const pick = (id: string) => setAsked((list) => [...list, ...page.chips.filter((c) => c.id === id)]);
  const scope = { people: page.people, viewerId: "neha", lang, demo: true };
  return (
    <div className="grid gap-4">
      <DemoBanner lang={lang} />
      <BreezyHeader lang={lang} title={t("breezyDemo.title")} uses={t("breezy.demo.uses", { place: page.place, time: page.updated })} />
      <PromptChips lang={lang} chips={page.chips.map((c) => ({ id: c.id, label: c.question }))} onPick={pick} />
      <section aria-label={t("breezy.thread")} aria-live="polite" className="grid gap-3">
        {asked.map((chip, i) => (
          <div key={i} className="grid gap-3">
            <UserBubble text={chip.question} lang={lang} />
            <ReplyBubble text={chip.text} lang={lang}>
              {chip.cards.map((card, j) => (
                <SuggestionCard key={j} card={card} scope={scope} index={j} />
              ))}
              <SourceLine source={chip.source} lang={lang} />
            </ReplyBubble>
          </div>
        ))}
      </section>
      <p className="m-0 text-sm text-ink-muted">{t("breezy.disclaimer")}</p>
      <p className="m-0 flex items-center gap-2 rounded-sm border border-rule bg-card-2 px-3.5 py-3 font-bold">
        <Lock className="size-5" aria-hidden="true" />
        <Link href="/sign-in?next=%2Fask" className="text-brand underline">
          {t("breezy.signInToAsk")}
        </Link>
      </p>
      <Link href="/demo" className={`${btn.secondary} w-max`}>
        {t("demo.back")}
      </Link>
    </div>
  );
}

function SourceLine({ source, lang }: { source: DemoChip["source"]; lang: BreezyDemoPage["lang"] }) {
  const t = translator(lang);
  if (source === "gemini")
    return (
      <p className="m-0 flex items-center gap-1.5 text-sm font-bold text-ai">
        <Wind className="size-4" aria-hidden="true" />
        {t("breezy.made")}
      </p>
    );
  return (
    <p className="m-0 flex items-center gap-1.5 text-sm text-ink-muted">
      <Info className="size-4" aria-hidden="true" />
      {t("breezy.simpleAnswer")}
    </p>
  );
}
