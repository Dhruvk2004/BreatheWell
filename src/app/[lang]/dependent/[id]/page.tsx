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

/** Edit a child or teen, with Delete (spec 10.12): the guardian or the admin. */
export default function EditDependentPage(props: PageProps<"/[lang]/dependent/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditDependentContent {...props} />
    </Suspense>
  );
}

async function EditDependentContent({ params }: Pick<PageProps<"/[lang]/dependent/[id]">, "params">) {
  const { id } = await params;
  const page = loadDependent(await requireFamily(`/dependent/${encodeURIComponent(id)}`), id) ?? notFound();
  return <DependentForm page={page} lang={await currentLang()} />;
}
