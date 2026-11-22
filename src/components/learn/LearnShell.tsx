import type { ReactNode } from "react";
import type { Lang } from "@/i18n/t";
import { SignedInShell } from "../shell/SignedInShell";

/** Learn sits in the app's nav for a family member, and stands alone for everyone else. */
export function LearnShell({ lang, inFamily, children }: { lang: Lang; inFamily: boolean; children: ReactNode }) {
  if (!inFamily) return <>{children}</>;
  return (
    <SignedInShell lang={lang} here="learn">
      {children}
    </SignedInShell>
  );
}
