import Link from "next/link";
import { MessageCircle, Smile } from "lucide-react";
import { whatsappLink } from "@/domain/breezy/whatsapp";
import { translator, type Lang } from "@/i18n/t";
import { VerdictGlyph } from "../ui/icons";
import { btn } from "../ui/styles";
import type { Target } from "./cardText";

interface AddedNoteProps {
  readonly line: string;
  readonly target: Target;
  /** A member's `wa.me` text; null for yourself and for dependents. */
  readonly whatsapp: string | null;
  readonly onCard: boolean;
  readonly lang: Lang;
}

/** After a confirmed add: Send on WhatsApp for a member, Open the kid card for a dependent. */
export function AddedNote({ line, target, whatsapp, onCard, lang }: AddedNoteProps) {
  const t = translator(lang);
  return (
    <div role="status" className="grid gap-2 rounded-[12px] bg-brand-tint px-3.5 py-3">
      <p className="m-0 flex items-start gap-2 font-bold">
        <VerdictGlyph verdict="go" />
        {line}
      </p>
      {whatsapp && (
        <>
          <a href={whatsappLink(whatsapp)} target="_blank" rel="noopener noreferrer" className={`${btn.primary} ${btn.small} w-max`}>
            <MessageCircle className="size-5" aria-hidden="true" />
            {t("breezy.whatsapp")}
          </a>
          <p className="m-0 text-sm text-ink-muted">{t("breezy.whatsappNote", { text: whatsapp })}</p>
        </>
      )}
      {target.kind === "dependent" && onCard && (
        <Link href={`/kid/${target.id}`} className={`${btn.secondary} ${btn.small} w-max`}>
          <Smile className="size-5" aria-hidden="true" />
          {t("breezy.openKid", { name: target.name })}
        </Link>
      )}
    </div>
  );
}
