import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { BandSkeleton } from "@/components/air/AirStates";
import { AirNowView } from "@/components/air/AirNowView";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadAirNowPage } from "@/server/air/airNowPage";
import { airDeps, airLimiter } from "@/server/air/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "air.title") });

/** Air now: the shell is static; the place's air streams in behind "Checking the air…". */
export default function AirPage({ searchParams }: PageProps<"/[lang]/air">) {
  return (
    <Suspense fallback={<AirLoading />}>
      <AirContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AirContent({ searchParams }: Pick<PageProps<"/[lang]/air">, "searchParams">) {
  // Request time from here on: the air, the clock and the rate limit are per request.
  await connection();
  const lang = await currentLang();
  const page = await loadAirNowPage(await searchParams, await headers(), airDeps(), airLimiter, lang);
  return <AirNowView page={page} lang={lang} />;
}

async function AirLoading() {
  const lang = await currentLang();
  return (
    <div className="grid gap-5">
      <h1 className="sr-only">{t(lang, "air.title")}</h1>
      <BandSkeleton lang={lang} />
    </div>
  );
}
