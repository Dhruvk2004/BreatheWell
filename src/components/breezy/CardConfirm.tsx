"use client";

import { Info } from "lucide-react";
import { confirmCard } from "@/client/breezy";
import type { ActionBody, BreezyCard } from "@/domain/breezy/answer";
import { translator, type Lang } from "@/i18n/t";
import { ConfirmDialog } from "../form/ConfirmDialog";
import { btn, noteInfo } from "../ui/styles";
import { addLabel, confirmNote, confirmTitle, type Target } from "./cardText";
import { failureText } from "../ui/failure";

export interface Added {
  readonly onCard: boolean;
  readonly whatsapp: string | null;
}

interface CardConfirmProps {
  readonly card: BreezyCard;
  /** The card's action, known not to be `share` (that one has Copy and Share instead). */
  readonly action: ActionBody["type"];
  readonly target: Target;
  readonly time: string | null;
  readonly lang: Lang;
  readonly onAdded: (added: Added) => void;
}

/**
 * The confirm sheet before any write (spec 7.7.4, design 10.10): it names the person, says where
 * the item will show (and when a dependent's item stays off the kid card), and only then sends it.
 */
export function CardConfirm({ card, action, target, time, lang, onAdded }: CardConfirmProps) {
  const t = translator(lang);
  const add = async (): Promise<string | null> => {
    try {
      const added = await confirmCard({
        type: action,
        forId: target.id,
        date: card.date,
        time,
        activity: card.activity,
        item: card.item,
        factId: card.factId,
      });
      onAdded(added);
      return null;
    } catch (error) {
      return failureText(error, lang, "breezy.addFailed", { rules_changed: "breezy.rulesChanged" });
    }
  };
  const showsOff = target.kind === "dependent" && !card.onCard && !target.self;
  return (
    <ConfirmDialog
      trigger={addLabel(card, target, lang)}
      triggerClassName={`${btn.primary} ${btn.small}`}
      title={confirmTitle(card, target, lang)}
      cancel={t("common.cancel")}
      confirm={t("breezy.confirm.add")}
      onConfirm={add}
    >
      <p className={showsOff ? noteInfo : "m-0"}>
        {showsOff && <Info className="size-5 shrink-0" aria-hidden="true" />}
        {confirmNote(card, target, lang)}
      </p>
    </ConfirmDialog>
  );
}
