import type { Metadata } from "next";
import { Privacy } from "@/components/privacy/Privacy";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "privacy.metaTitle") });

/** Privacy (spec 10.16). */
export default async function PrivacyPage() {
  return <Privacy lang={await currentLang()} />;
}
