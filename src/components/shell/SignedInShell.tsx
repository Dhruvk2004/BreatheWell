import Link from "next/link";
import { BookOpen, House, Users, Wind } from "lucide-react";
import type { ReactNode } from "react";
import { translator, type Lang } from "@/i18n/t";
import { OfflinePlan } from "../plan/OfflinePlan";

const LINK =
  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-sm font-bold text-brand no-underline aria-[current=page]:text-ink";

type Here = "today" | "breezy" | "learn" | "family" | null;

function AppNav({ lang, here, className }: { lang: Lang; here: Here; className: string }) {
  const t = translator(lang);
  const items = [
    { key: "today", href: "/today", label: t("shell.nav.today"), Icon: House },
    { key: "breezy", href: "/ask", label: t("shell.nav.breezy"), Icon: Wind },
    { key: "learn", href: "/learn", label: t("shell.nav.learn"), Icon: BookOpen },
    { key: "family", href: "/family/settings", label: t("shell.nav.family"), Icon: Users },
  ] as const;
  return (
    <nav aria-label={t("shell.nav.app")} className={className}>
      <ul className="m-0 flex list-none p-0">
        {items.map(({ key, href, label, Icon }) => (
          <li key={key} className="flex flex-1">
            <Link href={href} aria-current={here === key ? "page" : undefined} className={LINK}>
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Signed-in pages (design notes 4, component table "BottomNav"): Today · Breezy · Learn · Family, a bar at
 * the bottom of the phone screen and a top nav from 768 px. Visual order is DOM order (no CSS
 * `order`), so each layout has its own copy and only one is displayed (the other is
 * `display: none`, out of the accessibility tree). Offline, every page
 * but Today (which says so in its plan slot) starts with the saved plan (F24).
 */
export function SignedInShell({ lang, here, children }: { lang: Lang; here: Here; children: ReactNode }) {
  return (
    <>
      <AppNav lang={lang} here={here} className="mb-6 hidden rounded-[16px] border border-rule bg-card px-2 md:block" />
      {here !== "today" && <OfflinePlan />}
      {children}
      <AppNav lang={lang} here={here} className="sticky bottom-0 z-[5] -mx-4 mt-6 border-t border-rule bg-card px-2 md:hidden" />
    </>
  );
}
