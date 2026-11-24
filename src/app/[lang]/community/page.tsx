import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { CommunityLoading, CommunityView } from "@/components/community/CommunityView";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadCommunityPage } from "@/server/community/page";
import { communityDeps, communityViewer } from "@/server/community/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "community.metaTitle") });

/** Community message: public; the message streams in behind "Writing today's message…". */
export default function CommunityPage({ searchParams }: PageProps<"/[lang]/community">) {
  return (
    <Suspense fallback={<Loading />}>
      <CommunityContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CommunityContent({ searchParams }: Pick<PageProps<"/[lang]/community">, "searchParams">) {
  await connection();
  const lang = await currentLang();
  const viewer = await communityViewer();
  const page = await loadCommunityPage(await searchParams, await headers(), communityDeps(), viewer.homeCell);
  return <CommunityView page={page} lang={lang} signedIn={viewer.signedIn} />;
}

async function Loading() {
  return <CommunityLoading lang={await currentLang()} />;
}
