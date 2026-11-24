import Link from "next/link";
import { translator, type Lang } from "@/i18n/t";
import { AccountMenu } from "./AccountMenu";
import { HeaderControls } from "./HeaderControls";
import { LogoMark } from "./Logo";

const NAV = "inline-flex min-h-11 items-center rounded-sm px-2.5 font-bold text-brand underline-offset-4 hover:underline";

/** Header on every page: logo, language and Sign in or the avatar menu. */
export function SiteHeader({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <header className="border-b border-rule bg-card">
      <div className="mx-auto flex w-full max-w-[60rem] items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-sm" aria-label={t("shell.home")}>
          <LogoMark />
          <span className="text-lg font-bold" aria-hidden="true" lang="en">
            <span className="text-ink">Breathe</span>
            <span className="text-brand">Well</span>
          </span>
        </Link>
        <nav aria-label={t("shell.nav.main")} className="hidden items-center gap-1 md:flex">
          <Link href="/air" className={NAV}>
            {t("shell.nav.airNow")}
          </Link>
          <Link href="/demo" className={NAV}>
            {t("shell.nav.demo")}
          </Link>
          <Link href="/learn" className={NAV}>
            {t("shell.nav.learn")}
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <HeaderControls lang={lang} />
          <AccountMenu lang={lang} />
        </div>
      </div>
    </header>
  );
}
