import { translator, type Lang } from "@/i18n/t";

/** The first Tab stop on every page: hidden until focused (spec 10, design header pattern). */
export function SkipLink({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <a
      href="#main"
      className="fixed top-2 left-2 z-50 -translate-y-24 rounded-sm bg-brand px-4 py-3 text-on-brand shadow-raised focus-visible:translate-y-0"
    >
      {t("shell.skip")}
    </a>
  );
}
