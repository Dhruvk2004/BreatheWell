import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { PageLoading } from "@/components/shell/PageLoading";
import { SignedInShell } from "@/components/shell/SignedInShell";
import { TodayView } from "@/components/today/TodayView";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { requireFamily } from "@/server/app/guards";
import { siteOrigin } from "@/server/app/origin";
import { loadToday } from "@/server/app/todayPage";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "today.metaTitle") });

/** Today (spec 10.8): the answer first, from code. */
export default function TodayPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <TodayContent />
    </Suspense>
  );
}

async function TodayContent() {
  const lang = await currentLang();
  const deps = appDeps();
  const page = await loadToday(await requireFamily("/today"), deps, lang);
  return (
    <SignedInShell lang={lang} here="today">
      <TodayView page={page} appOrigin={siteOrigin(deps.appOrigin, await headers())} lang={lang} />
    </SignedInShell>
  );
}
