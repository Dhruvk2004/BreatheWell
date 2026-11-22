import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateFamily } from "@/components/family/CreateFamily";
import { PageLoading } from "@/components/shell/PageLoading";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { requireNoFamily } from "@/server/app/guards";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "fam.metaTitle") });

/** Create family (spec 10.6). */
export default function NewFamilyPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewFamilyContent />
    </Suspense>
  );
}

async function NewFamilyContent() {
  await requireNoFamily("/family/new");
  return <CreateFamily lang={await currentLang()} />;
}
