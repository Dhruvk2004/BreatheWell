import { NotFound } from "@/components/system/NotFound";
import { currentLang } from "@/i18n/server";

export default async function NotFoundPage() {
  return <NotFound lang={await currentLang()} />;
}
