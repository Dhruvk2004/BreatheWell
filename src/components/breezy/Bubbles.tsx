import { translator, type Lang } from "@/i18n/t";
import type { ReactNode } from "react";
import { ListenButton } from "../ui/ListenButton";
import { BreezyMark } from "./BreezyMark";

/** The asker's own message (design: Mist bubble, right-aligned). */
export function UserBubble({ text, lang }: { text: string; lang: Lang }) {
  return (
    <div className="flex justify-end">
      <p className="m-0 max-w-[85%] rounded-[16px] rounded-tr-[4px] bg-brand-tint px-3.5 py-2.5 break-words">
        <span className="sr-only">{translator(lang)("breezy.you")}: </span>
        {text}
      </p>
    </div>
  );
}

/** Breezy's reply (Monsoon tint, AI-written), with सुनें / Listen and the AI label. */
export function ReplyBubble({ text, lang, children }: { text: string; lang: Lang; children?: ReactNode }) {
  const t = translator(lang);
  return (
    <div className="m-in flex items-start gap-2">
      <BreezyMark label={t("breezy.name")} />
      <div className="grid min-w-0 flex-1 gap-2">
        <div lang={lang} className="grid gap-2 rounded-[16px] rounded-tl-[4px] bg-ai-tint px-3.5 py-2.5">
          <p className="m-0 break-words">{text}</p>
          <ListenButton text={text} lang={lang} label={t("listen.reply")} />
        </div>
        {children}
      </div>
    </div>
  );
}
