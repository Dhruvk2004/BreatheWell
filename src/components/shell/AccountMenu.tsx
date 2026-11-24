"use client";

import Link from "next/link";
import { Lock, Pencil, Users } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { translator, type Lang } from "@/i18n/t";
import { SignOutButton } from "../profile/SignOutButton";

/** The `bw-acct` cookie holds only initials ("NS"), set with the session (src/server/auth/cookies.ts). */
export function accountInitials(cookie: string): string | null {
  const match = /(?:^|;\s*)bw-acct=([^;]*)/.exec(cookie);
  const value = match ? decodeURIComponent(match[1]) : "";
  return /^\p{L}{1,2}$/u.test(value) ? value : null;
}

const noop = () => () => undefined;
const ITEM = "flex min-h-11 w-full items-center gap-2.5 px-4 font-bold text-ink no-underline hover:bg-brand-tint";

/** Escape closes the open menu and puts focus back on the avatar. */
function useEscape(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);
}

/**
 * Sign in, or the avatar menu once signed in: Profile · Family · Privacy · Sign out.
 * A disclosure button with a list of links (no ARIA menu role to get wrong); Escape closes it.
 */
export function AccountMenu({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const initials = useSyncExternalStore(
    noop,
    () => accountInitials(document.cookie),
    () => null,
  );
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  useEscape(open, close);
  if (!initials) return <SignInLink label={t("shell.signIn")} />;
  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={t("shell.account.menu")}
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center rounded-full bg-brand-tint font-bold text-brand"
      >
        <span aria-hidden="true">{initials}</span>
      </button>
      <MenuList open={open} onPick={() => setOpen(false)} lang={lang} />
    </div>
  );
}

function SignInLink({ label }: { label: string }) {
  return (
    <Link
      href="/sign-in"
      className="inline-flex min-h-11 items-center rounded-sm px-3 font-bold text-brand underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );
}

function MenuList({ open, onPick, lang }: { open: boolean; onPick: () => void; lang: Lang }) {
  const t = translator(lang);
  const links = [
    { href: "/profile", label: t("shell.account.profile"), Icon: Pencil },
    { href: "/family/settings", label: t("shell.account.family"), Icon: Users },
    { href: "/privacy", label: t("shell.account.privacy"), Icon: Lock },
  ];
  return (
    <div
      id="account-menu"
      hidden={!open}
      className="absolute top-12 right-0 z-10 w-52 overflow-hidden rounded-[12px] border border-rule bg-card py-1.5 shadow-raised"
    >
      <ul className="m-0 list-none p-0">
        {links.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} className={ITEM} onClick={onPick}>
              <Icon className="size-5 text-brand" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
        <li>
          <SignOutButton label={t("shell.account.signOut")} className={`${ITEM} border-0 bg-transparent text-left`} />
        </li>
      </ul>
    </div>
  );
}
