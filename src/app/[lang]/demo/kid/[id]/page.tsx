import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BandSkeleton } from "@/components/air/AirStates";
import { KidView } from "@/components/kid/KidView";
import { DEMO_FAMILY } from "@/data/demo/family";
import { parseDemoQuery } from "@/data/demo/query";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { airDeps } from "@/server/air/runtime";
import { loadKidPage } from "@/server/demo/kidPage";

export const generateStaticParams = () => DEMO_FAMILY.filter((p) => p.kind === "dependent").map((p) => ({ id: p.id }));

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "kid.metaTitle") });

/** A demo dependent's kid card: public, from fixtures. */
export default function KidCardPage(props: PageProps<"/[lang]/demo/kid/[id]">) {
  return (
    <Suspense fallback={<KidLoading />}>
      <KidContent {...props} />
    </Suspense>
  );
}

async function KidContent({ params, searchParams }: PageProps<"/[lang]/demo/kid/[id]">) {
  // Request time from here on: the air, the clock and the rate limit are per request.
  await connection();
  const lang = await currentLang();
  const { id } = await params;
  const kid = (await loadKidPage(id, parseDemoQuery(await searchParams), lang, airDeps())) ?? notFound();
  return <KidView kid={kid} lang={lang} />;
}

async function KidLoading() {
  return <BandSkeleton lang={await currentLang()} />;
}
