"use client";

import { translator } from "@/i18n/t";
import type { BreezyPage } from "@/view/breezy";
import { AskBar } from "./AskBar";
import { BreezyHeader } from "./BreezyHeader";
import { familyChips, PromptChips } from "./PromptChips";
import { Thread } from "./Thread";
import { useBreezy } from "./useBreezy";

/** Breezy for a signed-in adult (spec 10.10): header, chips with the family's names, the thread, the ask bar and the disclaimer. */
export function BreezyView({ page }: { page: BreezyPage }) {
  const { lang } = page;
  const t = translator(lang);
  const { entries, busy, send, pickAlias } = useBreezy();
  const uses = page.updated ? t("breezy.uses", { place: page.place, time: page.updated }) : t("breezy.usesNoAir", { place: page.place });
  const chips = familyChips(page.people, page.viewerId, lang);
  return (
    <div className="grid gap-4">
      <BreezyHeader lang={lang} title={t("breezy.name")} uses={uses} />
      <PromptChips lang={lang} chips={chips} disabled={busy} onPick={(_, label) => send(label)} />
      <Thread page={page} entries={entries} busy={busy} onAlias={pickAlias} />
      <p className="m-0 text-sm text-ink-muted">{t("breezy.disclaimer")}</p>
      <AskBar lang={lang} busy={busy} onSend={send} />
    </div>
  );
}
