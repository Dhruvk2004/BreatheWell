import type { Metadata } from "next";
import { Suspense } from "react";
import { Learn } from "@/components/learn/Learn";
import { LearnShell } from "@/components/learn/LearnShell";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { currentViewer } from "@/server/app/guards";
import { loadYourDay } from "@/server/app/learnPage";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "learn.metaTitle") });

/** Learn (spec 10.11): the generic page at once; a signed-in adult also gets "Your choices today". */
export default function LearnPage() {
  return (
    <Suspense fallback={<Generic />}>
      <LearnContent />
    </Suspense>
  );
}

async function LearnContent() {
  const lang = await currentLang();
  const viewer = await currentViewer();
  const yourDay = await loadYourDay(viewer, appDeps());
  return (
    <LearnShell lang={lang} inFamily={viewer.kind === "signed_in" && viewer.bundle !== null}>
      <Learn lang={lang} yourDay={yourDay} />
    </LearnShell>
  );
}

async function Generic() {
  return <Learn lang={await currentLang()} />;
}
