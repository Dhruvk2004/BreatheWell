import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BandSkeleton } from "@/components/air/AirStates";
import { DemoFamily } from "@/components/demo/DemoFamily";
import { parseDemoQuery } from "@/data/demo/query";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { airDeps } from "@/server/air/runtime";
import { loadDemo } from "@/server/demo/demoPage";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "demo.metaTitle") });

/** Demo family (spec 10.3): the Sharma family on a recorded smog morning, no sign-in. */
export default function DemoPage({ searchParams }: PageProps<"/[lang]/demo">) {
  return (
    <Suspense fallback={<DemoLoading />}>
      <DemoContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DemoContent({ searchParams }: Pick<PageProps<"/[lang]/demo">, "searchParams">) {
  // Request time from here on: the air, the clock and the rate limit are per request.
  await connection();
  const lang = await currentLang();
  const data = await loadDemo(parseDemoQuery(await searchParams), airDeps());
  return <DemoFamily data={data} lang={lang} />;
}

async function DemoLoading() {
  const lang = await currentLang();
  return (
    <div className="grid gap-5">
      <h1 className="m-0 text-2xl font-bold">{t(lang, "demo.title")}</h1>
      <BandSkeleton lang={lang} />
    </div>
  );
}
