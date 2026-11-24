import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/ProfileView";
import { PageLoading } from "@/components/shell/PageLoading";
import { SignedInShell } from "@/components/shell/SignedInShell";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadProfile } from "@/server/app/accountPages";
import { requireAccount } from "@/server/app/guards";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "prof.metaTitle") });

/** Profile settings; before onboarding has saved anything, onboarding. */
export default function ProfilePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const lang = await currentLang();
  const page = (await loadProfile(await requireAccount("/profile"), appDeps())) ?? redirect("/onboarding");
  return (
    <SignedInShell lang={lang} here="family">
      <ProfileView page={page} lang={lang} />
    </SignedInShell>
  );
}
