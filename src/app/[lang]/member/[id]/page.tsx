import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MemberView } from "@/components/member/MemberView";
import { PageLoading } from "@/components/shell/PageLoading";
import { SignedInShell } from "@/components/shell/SignedInShell";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { requireFamily } from "@/server/app/guards";
import { loadMember } from "@/server/app/todayPage";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "member.metaTitle") });

/** Member plan (spec 10.9). */
export default function MemberPage(props: PageProps<"/[lang]/member/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <MemberContent {...props} />
    </Suspense>
  );
}

async function MemberContent({ params }: Pick<PageProps<"/[lang]/member/[id]">, "params">) {
  const lang = await currentLang();
  const { id } = await params;
  const page = (await loadMember(await requireFamily(`/member/${encodeURIComponent(id)}`), id, appDeps(), lang)) ?? notFound();
  return (
    <SignedInShell lang={lang} here="today">
      <MemberView page={page} lang={lang} />
    </SignedInShell>
  );
}
