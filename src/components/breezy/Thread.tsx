"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { translator, type Lang, type MessageKey } from "@/i18n/t";
import type { BreezyPage } from "@/view/breezy";
import { AliasQuestion } from "./AliasQuestion";
import { ReplyBubble, UserBubble } from "./Bubbles";
import { Basics, CodeLine, EmergencyNote, QuotaNote } from "./FixedNotes";
import { SuggestionCard } from "./SuggestionCard";
import { TypingIndicator } from "./TypingIndicator";
import { SAVING_PAUSED } from "../ui/failure";
import { btn } from "../ui/styles";
import type { Entry } from "./useBreezy";

const ERROR_TEXT: Readonly<Record<string, MessageKey>> = {
  rate_limited: "breezy.rateLimited",
  [SAVING_PAUSED]: "common.savingPaused",
};

interface ThreadProps {
  readonly page: BreezyPage;
  readonly entries: readonly Entry[];
  readonly busy: boolean;
  readonly onAlias: (kin: string, forId: string, question: string) => Promise<boolean>;
}

function EntryView({ entry, page, onAlias }: { entry: Entry; page: BreezyPage; onAlias: ThreadProps["onAlias"] }) {
  const { lang } = page;
  const t = translator(lang);
  if (entry.kind === "user") return <UserBubble text={entry.text} lang={lang} />;
  if (entry.kind === "error") return <CodeLine text={t(ERROR_TEXT[entry.code] ?? "common.offline")} />;
  const { answer, question } = entry;
  if (answer.kind === "emergency") return <EmergencyNote lang={lang} />;
  if (answer.kind === "basics") return <Basics basics={page.basics} lang={lang} />;
  if (answer.kind === "quota") return <QuotaNote lang={lang} />;
  if (answer.kind === "ask_alias")
    return <AliasQuestion word={answer.word} people={page.people} lang={lang} onPick={(id) => onAlias(answer.kin, id, question)} />;
  const scope = { people: page.people, viewerId: page.viewerId, lang };
  return (
    <ReplyBubble text={answer.text} lang={answer.lang}>
      {answer.refusal === "admin_action" && page.isAdmin && <SettingsLink lang={lang} />}
      {answer.cards.map((card, i) => (
        <SuggestionCard key={i} card={card} scope={scope} index={i} />
      ))}
      <p className="m-0 text-sm font-bold text-ai">{t("breezy.made")}</p>
    </ReplyBubble>
  );
}

/** An admin's refused admin action: "You can do that in Family settings." and the link. */
function SettingsLink({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <p className="m-0 grid gap-2">
      {t("breezy.refusal.settings")}
      <Link href="/family/settings" className={`${btn.secondary} ${btn.small} w-max`}>
        {t("breezy.refusal.open")}
      </Link>
    </p>
  );
}

/**
 * What the one polite status node says for the newest answer: "Breezy answered." (the reply itself
 * is the next message in the thread); the emergency note is an alert of its own, so it is never
 * announced twice.
 */
function announcement(entries: readonly Entry[], lang: Lang): string {
  const last = entries.at(-1);
  if (last?.kind !== "answer" || last.answer.kind === "emergency") return "";
  return translator(lang)("breezy.answered");
}

/**
 * The conversation: new answers are read out by one polite status node,
 * the emergency note by its own alert role (so it is never read twice), and the new message scrolls
 * into view (no smooth scroll, so reduced motion needs nothing else).
 */
export function Thread({ page, entries, busy, onAlias }: ThreadProps) {
  const end = useRef<HTMLDivElement>(null);
  // A block body: newer browsers return a Promise from scrollIntoView, which must not become the cleanup.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [entries.length, busy]);
  return (
    <section aria-label={translator(page.lang)("breezy.thread")} className="grid gap-3">
      {entries.map((entry) => (
        <EntryView key={entry.id} entry={entry} page={page} onAlias={onAlias} />
      ))}
      {busy && <TypingIndicator lang={page.lang} />}
      <p role="status" className="sr-only">
        {announcement(entries, page.lang)}
      </p>
      <div ref={end} />
    </section>
  );
}
