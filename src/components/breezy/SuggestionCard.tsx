"use client";

import { Info, Wind } from "lucide-react";
import { useState } from "react";
import type { BreezyCard } from "@/domain/breezy/answer";
import { translator, type Lang } from "@/i18n/t";
import type { BreezyPerson } from "@/view/breezy";
import { VerdictChip } from "../air/VerdictChip";
import { WhyPanel } from "../air/WhyPanel";
import { CopyButton } from "../ui/CopyButton";
import { ShareButton } from "../ui/ShareButton";
import { noteInfo } from "../ui/styles";
import { AddedNote } from "./AddedNote";
import { CardConfirm, type Added } from "./CardConfirm";
import { PicturePanel } from "./PicturePanel";
import { addedLine, whenLine, type Target } from "./cardText";
import { WhoIsThisFor } from "./WhoIsThisFor";

export interface CardScope {
  readonly people: readonly BreezyPerson[];
  readonly viewerId: string;
  readonly lang: Lang;
  /** Demo mode: actions write nothing. */
  readonly demo?: boolean;
}

/** The card's time and chip for the chosen person: its own, or that person's rule slot. */
function slotOf(card: BreezyCard, forId: string | null) {
  if (card.forId || !card.slots || !forId) return { time: card.time, verdict: card.verdict, blocked: false };
  const slot = card.slots[forId];
  return { time: slot?.time ?? null, verdict: slot?.verdict ?? null, blocked: !slot };
}

/**
 * A suggestion card: title, who and when, the verdict chip from the
 * rules (none without an activity), Breezy's why, then Add (behind the confirm sheet), Share and
 * Why? (the code's "Picture it" for an adult's timed card, the fact panel otherwise). A card without
 * a person first asks "Who is this for?".
 */
export function SuggestionCard({ card, scope, index }: { card: BreezyCard; scope: CardScope; index: number }) {
  const { lang, people } = scope;
  const t = translator(lang);
  const [chosen, setChosen] = useState<string | null>(card.forId);
  const [added, setAdded] = useState<Added | null>(null);
  const person = people.find((p) => p.id === chosen);
  const target: Target | null = person ? { ...person, self: person.id === scope.viewerId } : null;
  const slot = slotOf(card, chosen);
  return (
    <article className="m-in grid gap-2 rounded-[16px] border border-rule bg-card p-4" style={{ ["--i" as string]: index }}>
      <p className="m-0 flex items-center gap-1.5 text-sm font-bold text-ai">
        <Wind className="size-4" aria-hidden="true" />
        {t("breezy.suggestion")}
      </p>
      <h2 className="m-0 text-lg font-bold">{card.title}</h2>
      {target && (
        <p className="m-0 text-sm text-ink-muted">
          {t("breezy.for", { name: target.name })} · {whenLine({ date: card.date, time: slot.time }, lang)}
        </p>
      )}
      {slot.verdict && card.activity && <VerdictChip verdict={slot.verdict} lang={lang} />}
      {card.why && <p className="m-0">{card.why}</p>}
      {!card.forId && card.action !== "share" && !added && <WhoIsThisFor people={people} chosen={chosen} onPick={setChosen} lang={lang} />}
      {target && slot.blocked && <p className={noteInfo}>{t("breezy.whoAvoid", { name: target.name })}</p>}
      <CardActions card={card} scope={scope} target={slot.blocked ? null : target} time={slot.time} added={added} onAdded={setAdded} />
      {card.picture && target?.kind === "adult" ? (
        <PicturePanel picture={card.picture} factId={card.factId} lang={lang} />
      ) : (
        card.factId && <WhyPanel lang={lang} factId={card.factId} />
      )}
    </article>
  );
}

interface ActionsProps {
  readonly card: BreezyCard;
  readonly scope: CardScope;
  readonly target: Target | null;
  readonly time: string | null;
  readonly added: Added | null;
  readonly onAdded: (added: Added) => void;
}

function CardActions({ card, scope, target, time, added, onAdded }: ActionsProps) {
  const { lang } = scope;
  const t = translator(lang);
  const text = card.item[lang];
  if (card.action === "share")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} label={t("share.copy")} done={t("share.copied")} failed={t("share.copyFailed")} />
        <ShareButton text={text} label={t("share.native")} />
      </div>
    );
  if (!target) return null;
  if (scope.demo)
    return (
      <p className={noteInfo}>
        <Info className="size-5 shrink-0" aria-hidden="true" />
        {t("breezy.demo.inFamily", { name: target.name })}
      </p>
    );
  if (added)
    return (
      <AddedNote
        line={addedLine(card, target, added.onCard, lang)}
        target={target}
        whatsapp={added.whatsapp}
        onCard={added.onCard}
        lang={lang}
      />
    );
  return <CardConfirm card={card} action={card.action} target={target} time={time} lang={lang} onAdded={onAdded} />;
}
