import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinForm } from "@/components/family/JoinForm";
import { PageLoading } from "@/components/shell/PageLoading";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { requireAccount } from "@/server/app/guards";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "join.metaTitle") });

/** Join with a typed code (spec 10.7). */
export default function JoinPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <JoinContent />
    </Suspense>
  );
}

async function JoinContent() {
  const viewer = await requireAccount("/join");
  const lang = await currentLang();
  return (
    <div className="mx-auto grid w-full max-w-[30rem] gap-5">
      <h1 className="m-0 text-2xl font-bold">{t(lang, "join.title")}</h1>
      <JoinForm lang={lang} onboarded={viewer.user.onboarded} />
    </div>
  );
}
