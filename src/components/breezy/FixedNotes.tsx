import Link from "next/link";
import { Phone, TriangleAlert } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import type { BasicsView } from "@/view/breezy";
import { VerdictChip } from "../air/VerdictChip";
import { btn } from "../ui/styles";
import { BreezyMark } from "./BreezyMark";

/**
 * Breezy's fixed-text states (design 10.10): code text, never Gemini. The emergency note is not a
 * Breezy bubble (ink outline, alert role, a Call 112 link); the basics and the daily limit are.
 */
export function EmergencyNote({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <div role="alert" className="grid gap-2 rounded-[12px] border-2 border-ink bg-card px-4 py-3">
      <p className="m-0 flex items-start gap-2 font-bold">
        <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
        {t("breezy.emergency")}
      </p>
      <a href="tel:112" className={`${btn.ink} ${btn.small} w-max`}>
        <Phone className="size-5" aria-hidden="true" />
        {t("breezy.call112")}
      </a>
    </div>
  );
}

function CodeBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-in flex items-start gap-2">
      <BreezyMark />
      <div className="grid gap-2 rounded-[16px] rounded-tl-[4px] bg-ai-tint px-3.5 py-2.5">{children}</div>
    </div>
  );
}

/** Over 10 s, or Gemini down or unusable: today's rows from the rules. */
export function Basics({ basics, lang }: { basics: readonly BasicsView[]; lang: Lang }) {
  const t = translator(lang);
  return (
    <CodeBubble>
      <p className="m-0">{basics.length ? t("breezy.basics") : t("breezy.basicsNone")}</p>
      {basics.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {basics.map((row) => (
            <li key={row.id} className="grid gap-1">
              <span className="flex flex-wrap items-center gap-2 font-bold">
                {row.name} <VerdictChip verdict={row.verdict} lang={lang} />
              </span>
              <span>{row.line}</span>
            </li>
          ))}
        </ul>
      )}
    </CodeBubble>
  );
}

/** The daily limit (spec 7.8): no queue, a way back to the plan. */
export function QuotaNote({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <CodeBubble>
      <p className="m-0">{t("breezy.quota")}</p>
      <Link href="/today" className={`${btn.secondary} ${btn.small} w-max`}>
        {t("breezy.openPlan")}
      </Link>
    </CodeBubble>
  );
}

/** A plain code line from Breezy (errors, rate limits). */
export function CodeLine({ text }: { text: string }) {
  return (
    <CodeBubble>
      <p className="m-0">{text}</p>
    </CodeBubble>
  );
}
