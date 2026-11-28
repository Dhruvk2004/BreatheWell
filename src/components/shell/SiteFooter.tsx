import Link from "next/link";
import { translator, type Lang } from "@/i18n/t";

const LINK = "inline-flex min-h-11 items-center text-brand underline underline-offset-2";

/** The header's page links, repeated in the footer on phones, where the header has room only for the controls. */
const PHONE_LINKS = [
  { href: "/air", key: "shell.nav.airNow" },
  { href: "/demo", key: "shell.nav.demo" },
  { href: "/learn", key: "shell.nav.learn" },
] as const;

/**
 * Footer on every page: Privacy · About the data · Open-Meteo credit · For adults (18+),
 * led on phones by Air now · Sample family · Learn.
 */
export function SiteFooter({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <footer className="mt-auto border-t border-rule">
      <nav
        aria-label={t("shell.footer.label")}
        className="mx-auto flex w-full max-w-[60rem] flex-wrap items-center gap-x-5 px-4 py-4 text-sm text-ink-muted"
      >
        {PHONE_LINKS.map(({ href, key }) => (
          <Link key={href} href={href} className={`${LINK} font-bold md:hidden`}>
            {t(key)}
          </Link>
        ))}
        <Link href="/privacy" className={LINK}>
          {t("shell.footer.privacy")}
        </Link>
        <Link href="/learn#numbers" className={LINK}>
          {t("shell.footer.aboutData")}
        </Link>
        <a href="https://open-meteo.com/" className={LINK} rel="noopener noreferrer" target="_blank">
          {t("shell.footer.credit")}
        </a>
        <span className="inline-flex min-h-11 items-center">{t("shell.footer.adults")}</span>
      </nav>
    </footer>
  );
}
