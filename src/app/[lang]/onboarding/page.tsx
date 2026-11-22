import type { Metadata } from "next";
import { Suspense } from "react";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { PageLoading } from "@/components/shell/PageLoading";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadOnboarding } from "@/server/app/accountPages";
import { requireAccount } from "@/server/app/guards";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "onb.metaTitle") });

/** Onboarding (spec 10.5, 5.6). */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  const viewer = await requireAccount("/onboarding");
  return <Onboarding page={await loadOnboarding(viewer, appDeps())} lang={await currentLang()} />;
}
