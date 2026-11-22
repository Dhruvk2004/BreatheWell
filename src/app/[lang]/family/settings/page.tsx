import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/shell/PageLoading";
import { SettingsView } from "@/components/settings/SettingsView";
import { SignedInShell } from "@/components/shell/SignedInShell";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadSettingsPage } from "@/server/app/accountPages";
import { requireFamily } from "@/server/app/guards";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "set.metaTitle") });

/** Family settings (spec 10.14). */
export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const lang = await currentLang();
  const { page, joinedAt, code } = await loadSettingsPage(await requireFamily("/family/settings"), appDeps(), lang);
  return (
    <SignedInShell lang={lang} here="family">
      <SettingsView page={page} joinedAt={joinedAt} code={code} lang={lang} />
    </SignedInShell>
  );
}
