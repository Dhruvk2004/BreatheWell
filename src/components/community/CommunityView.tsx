import Link from "next/link";
import { Info, MessageCircle, Wind } from "lucide-react";
import { whatsappLink } from "@/domain/breezy/whatsapp";
import { bandWordKey } from "@/i18n/labels";
import { translator, type Lang } from "@/i18n/t";
import type { CommunityPage } from "@/view/community";
import { BandGlyph } from "../ui/icons";
import { BAND_FILL } from "../ui/bandStyle";
import { CopyButton } from "../ui/CopyButton";
import { ShareButton } from "../ui/ShareButton";
import { aiLine, btn, noteInfo, noteNeutral } from "../ui/styles";
import { MessageBox, messageText } from "./MessageBox";

type Ready = Extract<CommunityPage, { kind: "ready" }>;

/** Copy English · Copy Hindi · Copy both · Share · WhatsApp (spec 10.13 item 3). No personal data in the link. */
function ShareRow({ page, lang }: { page: Ready; lang: Lang }) {
  const t = translator(lang);
  const en = messageText(page.messages.en);
  const hi = messageText(page.messages.hi);
  const both = `${en}\n\n${hi}`;
  const copy = { done: t("share.copied"), failed: t("share.copyFailed") };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CopyButton text={en} label={t("community.copyEn")} {...copy} />
      <CopyButton text={hi} label={t("community.copyHi")} {...copy} />
      <CopyButton text={both} label={t("community.copyBoth")} {...copy} />
      <ShareButton text={both} label={t("share.native")} />
      <a href={whatsappLink(both)} target="_blank" rel="noopener noreferrer" className={`${btn.secondary} ${btn.small}`}>
        <MessageCircle className="size-5" aria-hidden="true" />
        {t("community.whatsapp")}
      </a>
    </div>
  );
}

function Ready({ page, lang }: { page: Ready; lang: Lang }) {
  const t = translator(lang);
  return (
    <>
      <p className={`m-0 inline-flex w-max items-center gap-2 rounded-sm px-3 py-1.5 font-bold ${BAND_FILL[page.band]}`}>
        <BandGlyph band={page.band} />
        {t(bandWordKey(page.band))} · {t("community.avg", { aqi: page.avg24 })}
      </p>
      <p className="m-0 text-sm font-bold">{t("community.audience")}</p>
      <MessageBox message={page.messages.en} lang="en" label={t("community.english")} />
      <MessageBox message={page.messages.hi} lang="hi" label={t("community.hindi")} />
      <ShareRow page={page} lang={lang} />
      {page.source === "gemini" ? (
        <p className={aiLine}>
          <Wind className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("community.made")}
        </p>
      ) : (
        <p className={noteInfo}>
          <Info className="size-5 shrink-0" aria-hidden="true" />
          {t("community.simple")}
        </p>
      )}
    </>
  );
}

/**
 * Community message (spec 10.13): public, the template first if Gemini has nothing; never
 * cigarettes. "Make your own family plan" opens Today for a signed-in viewer, sign-in otherwise.
 */
export function CommunityView({ page, lang, signedIn = false }: { page: CommunityPage; lang: Lang; signedIn?: boolean }) {
  const t = translator(lang);
  const place = page.kind === "ready" || page.kind === "unavailable" ? page.place : "";
  return (
    <div className="grid gap-4">
      <h1 className="m-0 text-2xl font-bold">{place ? t("community.title", { place }) : t("community.metaTitle")}</h1>
      {page.kind === "ready" && <Ready page={page} lang={lang} />}
      {page.kind === "unavailable" && <p className={noteNeutral}>{t("community.unavailable", { place })}</p>}
      {page.kind === "rate_limited" && <p className={noteNeutral}>{t("community.rateLimited")}</p>}
      {page.kind === "no_place" && (
        <p className={noteNeutral}>
          {t("community.noPlace")}{" "}
          <Link href="/" className="font-bold text-brand underline">
            {t("community.pickPlace")}
          </Link>
        </p>
      )}
      <Link href={signedIn ? "/today" : "/sign-in"} className={`${btn.primary} w-max`}>
        {t("community.cta")}
      </Link>
    </div>
  );
}

/** The static skeleton while the message is written (design 10.13 loading). */
export function CommunityLoading({ lang }: { lang: Lang }) {
  return (
    <div className="grid gap-4" aria-busy="true">
      <h1 className="m-0 text-2xl font-bold">{translator(lang)("community.metaTitle")}</h1>
      <p role="status" className="m-0 rounded-[12px] border border-rule bg-card-2 px-4 py-10 text-center text-ink-muted">
        {translator(lang)("community.loading")}
      </p>
    </div>
  );
}
