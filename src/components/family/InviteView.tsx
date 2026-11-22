"use client";

import Link from "next/link";
import { Info, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { newCode } from "@/client/actions";
import { formatCode } from "@/domain/family/joinCode";
import { t as tr, translator, type Lang } from "@/i18n/t";
import { ConfirmDialog } from "../form/ConfirmDialog";
import { CopyButton } from "../ui/CopyButton";
import { ShareButton } from "../ui/ShareButton";
import { btn, noteInfo } from "../ui/styles";
import { QrCode } from "./QrCode";
import { QrFullScreen } from "./QrFullScreen";
import { failureText } from "../ui/failure";

interface InviteViewProps {
  readonly familyName: string;
  readonly code: string | null;
  /** "Sat, 22 Nov, 6:10 pm", formatted on the server. */
  readonly validTill: string | null;
  readonly joinUrl: string | null;
  readonly lang: Lang;
}

/** Invite (spec 10.7, design 10.7): the code first, the QR, Copy link, Share, full screen, the steps and a new code. */
export function InviteView({ familyName, code, validTill, joinUrl, lang }: InviteViewProps) {
  const t = translator(lang);
  return (
    <div className="mx-auto grid w-full max-w-[34rem] gap-5">
      <h1 className="m-0 text-2xl font-bold">{t("invite.title")}</h1>
      {code && joinUrl ? (
        <CodeCard familyName={familyName} code={code} validTill={validTill ?? ""} joinUrl={joinUrl} lang={lang} />
      ) : (
        <p className={`m-0 ${noteInfo}`}>{t("invite.noCode")}</p>
      )}
      <ol className="m-0 grid gap-2 pl-6">
        <li>{t("invite.step1")}</li>
        <li>{t("invite.step2")}</li>
        <li>{t("invite.step3")}</li>
      </ol>
      <p className={`m-0 ${noteInfo}`}>
        <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
        {t("invite.children")}
      </p>
      <Link href="/today" className={btn.primary}>
        {t("invite.goToday")}
      </Link>
      <NewCode code={code} lang={lang} />
    </div>
  );
}

function CodeCard({
  familyName,
  code,
  validTill,
  joinUrl,
  lang,
}: {
  familyName: string;
  code: string;
  validTill: string;
  joinUrl: string;
  lang: Lang;
}) {
  const t = translator(lang);
  const shown = formatCode(code);
  const shareText = inviteShareText(lang, { url: joinUrl, code: shown, time: validTill });
  return (
    <section aria-labelledby="code-h" className="grid justify-items-center gap-3 rounded-[16px] border border-rule bg-card p-5 text-center">
      <h2 id="code-h" className="m-0 text-sm font-bold text-ink-muted">
        {t("invite.codeLabel")}
      </h2>
      <p className="m-0 font-mono text-[2.25em] font-bold tracking-[0.12em]" lang="en">
        {shown}
      </p>
      <p className="m-0 text-sm text-ink-muted">{t("invite.valid", { time: validTill })}</p>
      <QrCode link={joinUrl} label={t("invite.qrAlt")} />
      <div className="grid w-full grid-cols-2 gap-2">
        <CopyButton text={joinUrl} label={t("invite.copyLink")} done={t("invite.copied")} failed={t("share.copyFailed")} />
        <ShareButton text={shareText} label={t("share.native")} />
      </div>
      <QrFullScreen link={joinUrl} code={shown} validTill={validTill} familyName={familyName} lang={lang} />
    </section>
  );
}

/** The invite message (spec 5.3): bilingual, Hindi first, when the admin reads the app in Hindi. */
export function inviteShareText(lang: Lang, vars: { url: string; code: string; time: string }): string {
  const english = tr("en", "invite.shareText", vars);
  return lang === "hi" ? `${tr("hi", "invite.shareText", vars)}\n${english}` : english;
}

/** Make a new code (spec 5.9): the old one stops working at once. */
function NewCode({ code, lang }: { code: string | null; lang: Lang }) {
  const t = translator(lang);
  const router = useRouter();
  const make = async () => {
    try {
      await newCode();
      router.refresh();
      return null;
    } catch (error) {
      return failureText(error, lang, "common.error");
    }
  };
  const trigger = (
    <>
      <RefreshCw className="size-5" aria-hidden="true" />
      {t("invite.newCode")}
    </>
  );
  return (
    <ConfirmDialog
      trigger={trigger}
      triggerClassName={btn.secondary}
      title={t("invite.newCodeTitle")}
      cancel={t("common.cancel")}
      confirm={t("invite.newCodeConfirm")}
      onConfirm={make}
    >
      {code && <p className="m-0">{t("invite.newCodeBody", { code: formatCode(code) })}</p>}
    </ConfirmDialog>
  );
}
