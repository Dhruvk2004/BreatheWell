import Link from "next/link";
import type { CommunityMessage } from "@/ai/community/template";
import { translator, type Lang } from "@/i18n/t";
import { CopyButton } from "../ui/CopyButton";
import { sourceLine } from "../ui/styles";

/** The community message for this area (spec 7.6, 10.2 item 8), here as the template, labelled "Simple message". */
export function CommunityCard({ message, place, href, lang }: { message: CommunityMessage; place: string; href: string; lang: Lang }) {
  const t = translator(lang);
  const text = [message.header, message.body, message.together, message.footer].join("\n");
  return (
    <section aria-labelledby="community-h" className="grid gap-2 rounded-[12px] border border-rule bg-card px-4 py-3.5">
      <h2 id="community-h" className="m-0 text-sm font-normal text-ink-muted">
        {t("air.community.title", { place })}
      </h2>
      <p className="m-0 font-bold">{message.header}</p>
      <p className="m-0 text-[0.9375em]">{message.body}</p>
      <p className="m-0 text-[0.9375em]">{message.together}</p>
      <p className={sourceLine}>
        {t("air.community.simple")} · {message.footer}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} label={t("share.copy")} done={t("share.copied")} failed={t("share.copyFailed")} />
      </div>
      <Link href={href} className="font-bold text-brand underline">
        {t("air.community.open")}
      </Link>
    </section>
  );
}
