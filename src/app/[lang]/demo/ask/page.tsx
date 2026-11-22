import type { Metadata } from "next";
import { BreezyDemo } from "@/components/breezy/BreezyDemo";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { loadBreezyDemo } from "@/server/demo/demoBreezy";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "breezyDemo.title") });

/** Breezy (demo), spec 7.7.2: chips only, stored answers, writes nothing; no sign-in. Static: the Smog morning at 6 am. */
export default async function BreezyDemoPage() {
  const lang = await currentLang();
  return <BreezyDemo page={loadBreezyDemo({ scenario: "smog-morning", time: 6, view: "neha" }, lang)} />;
}
