import type { BreezyCard } from "@/domain/breezy/answer";
import { formatTime, parseHhMm } from "@/domain/time/format";
import { translator, type Lang, type MessageKey } from "@/i18n/t";
import type { BreezyPerson } from "@/view/breezy";

/**
 * The words around a suggestion card: "For: Dadaji · Today, 3:00
 * pm", the add button, the confirm question and the note after adding. Self, member and dependent
 * each get their own sentence; no pronouns.
 */
export type Target = BreezyPerson & { readonly self: boolean };

export function whenLine(card: Pick<BreezyCard, "date" | "time">, lang: Lang): string {
  const t = translator(lang);
  if (!card.time) return t(`breezy.day.${card.date}`);
  const { hour, minute } = parseHhMm(card.time);
  return t(card.date === "today" ? "breezy.when.today" : "breezy.when.tomorrow", { time: formatTime(hour, minute, lang) });
}

const plan = (card: Pick<BreezyCard, "action">) => card.action === "add_to_plan";

export function addLabel(card: Pick<BreezyCard, "action">, target: Target, lang: Lang): string {
  const t = translator(lang);
  if (target.self) return t(plan(card) ? "breezy.addMyPlan" : "breezy.addMyChecklist");
  return t(plan(card) ? "breezy.addPlan" : "breezy.addChecklist", { name: target.name });
}

export function confirmTitle(card: Pick<BreezyCard, "action" | "date" | "title">, target: Target, lang: Lang): string {
  const t = translator(lang);
  const vars = { title: card.title, name: target.name, day: t(`breezy.day.${card.date}`) };
  return t(plan(card) ? "breezy.confirm.plan" : "breezy.confirm.checklist", vars);
}

export function confirmNote(card: Pick<BreezyCard, "onCard">, target: Target, lang: Lang): string {
  const t = translator(lang);
  if (target.self) return t("breezy.confirm.self");
  if (target.kind === "adult") return t("breezy.confirm.note", { name: target.name });
  return t(card.onCard ? "breezy.confirm.kid" : "breezy.confirm.notOnCard", { name: target.name });
}

export function addedLine(card: Pick<BreezyCard, "action">, target: Target, onCard: boolean, lang: Lang): string {
  const key: MessageKey = target.self
    ? plan(card)
      ? "breezy.added.myPlan"
      : "breezy.added.myChecklist"
    : target.kind === "adult"
      ? plan(card)
        ? "breezy.added.plan"
        : "breezy.added.checklist"
      : !onCard
        ? "breezy.added.notOnCard"
        : plan(card)
          ? "breezy.added.kidPlan"
          : "breezy.added.kidChecklist";
  return translator(lang)(key, { name: target.name });
}
