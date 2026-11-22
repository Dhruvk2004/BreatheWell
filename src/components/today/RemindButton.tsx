import { t, type Lang } from "@/i18n/t";
import { CopyButton } from "../ui/CopyButton";

/** "Remind" (spec 5.11): copies one bilingual WhatsApp text with the app link; nothing is sent by us. */
export function RemindButton({ name, appOrigin, lang }: { name: string; appOrigin: string; lang: Lang }) {
  const url = `${appOrigin}/onboarding`;
  const text = `${t("en", "today.remindText", { url })}\n${t("hi", "today.remindText", { url })}`;
  return (
    <span className="relative z-[1] grid w-max gap-1">
      <CopyButton
        text={text}
        label={t(lang, "today.remind")}
        done={t(lang, "today.remindCopied")}
        failed={t(lang, "share.copyFailed")}
        className="w-max"
        ariaLabel={t(lang, "today.remindFor", { name })}
      />
    </span>
  );
}
