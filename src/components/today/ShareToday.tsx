import { translator, type Lang } from "@/i18n/t";
import { CopyButton } from "../ui/CopyButton";
import { ShareButton } from "../ui/ShareButton";

/**
 * "Share today's plan": the bilingual family text through the share sheet
 * where the browser has one, and Copy everywhere (paste it in the family WhatsApp group).
 */
export function ShareToday({ text, lang }: { text: string; lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-label={t("today.shareFor")} className="flex flex-wrap items-center gap-2">
      <ShareButton text={text} label={t("today.share")} />
      <CopyButton text={text} label={t("today.copyPlan")} done={t("share.copied")} failed={t("share.copyFailed")} />
    </section>
  );
}
