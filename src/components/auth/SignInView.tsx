import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import { LogoMark } from "../shell/Logo";
import { btn, noteNeutral } from "../ui/styles";
import { GoogleSignIn } from "./GoogleSignIn";

/** "Sign-in isn't configured" (spec 11): the public pages keep working, so say so and point to them. */
export function NotConfigured({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <div role="status" className={`${noteNeutral} grid gap-2`}>
      <p className="m-0 flex items-start gap-2 font-bold">
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t("auth.notConfigured")}
      </p>
      <p className="m-0">{t("auth.notConfiguredBody")}</p>
      <Link href="/demo" className={`${btn.secondary} ${btn.small} w-max`}>
        {t("auth.seeDemo")}
      </Link>
    </div>
  );
}

/** The adults-only small print under every sign-in button (spec 10.4 item 3). */
export function SignInSmallPrint({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <p className="m-0 text-sm text-ink-muted">
      {t("auth.small")}{" "}
      <Link href="/privacy" className="font-bold text-brand underline underline-offset-2">
        {t("shell.footer.privacy")}
      </Link>
    </p>
  );
}

/** Sign-in (spec 10.4, design 10.4). */
export function SignInView({ lang, configured, next }: { lang: Lang; configured: boolean; next: string | null }) {
  const t = translator(lang);
  return (
    <div className="mx-auto grid w-full max-w-[30rem] gap-5">
      <LogoMark />
      <h1 className="m-0 text-2xl font-bold">{t("auth.title")}</h1>
      {configured ? <GoogleSignIn lang={lang} next={next} buttonLabel={t("auth.continue")} /> : <NotConfigured lang={lang} />}
      <SignInSmallPrint lang={lang} />
    </div>
  );
}
