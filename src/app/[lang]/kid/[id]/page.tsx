import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FamilyKidView } from "@/components/kid/FamilyKidView";
import { PageLoading } from "@/components/shell/PageLoading";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { requireFamily } from "@/server/app/guards";
import { loadKidCard } from "@/server/app/kidCardPage";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "kid.metaTitle") });

/** A dependent's kid card (spec 10.12): family members only. */
export default function KidPage(props: PageProps<"/[lang]/kid/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <KidContent {...props} />
    </Suspense>
  );
}

async function KidContent({ params }: Pick<PageProps<"/[lang]/kid/[id]">, "params">) {
  const lang = await currentLang();
  const { id } = await params;
  const page = (await loadKidCard(await requireFamily(`/kid/${encodeURIComponent(id)}`), id, appDeps())) ?? notFound();
  return <FamilyKidView page={page} lang={lang} />;
}
