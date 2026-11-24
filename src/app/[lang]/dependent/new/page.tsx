import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DependentForm } from "@/components/dependent/DependentForm";
import { PageLoading } from "@/components/shell/PageLoading";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadDependent } from "@/server/app/dependentPage";
import { requireFamily } from "@/server/app/guards";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "dep.newTitle") });

/** Add a child or teen. */
export default function NewDependentPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewDependentContent />
    </Suspense>
  );
}

async function NewDependentContent() {
  const page = loadDependent(await requireFamily("/dependent/new"), null) ?? notFound();
  return <DependentForm page={page} lang={await currentLang()} />;
}
