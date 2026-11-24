import type { Metadata } from "next";
import { Suspense } from "react";
import { BreezyView } from "@/components/breezy/BreezyView";
import { PageLoading } from "@/components/shell/PageLoading";
import { SignedInShell } from "@/components/shell/SignedInShell";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadBreezy } from "@/server/app/breezyPage";
import { requireFamily } from "@/server/app/guards";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "breezy.metaTitle") });

/** Breezy, the assistant: signed-in adults only; the public demo is /demo/ask. */
export default function AskPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AskContent />
    </Suspense>
  );
}

async function AskContent() {
  const lang = await currentLang();
  const page = await loadBreezy(await requireFamily("/ask"), appDeps(), lang);
  return (
    <SignedInShell lang={lang} here="breezy">
      <BreezyView page={page} />
    </SignedInShell>
  );
}
