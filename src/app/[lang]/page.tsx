import { Landing } from "@/components/landing/Landing";
import { currentLang } from "@/i18n/server";
import { recordedDemo } from "@/server/demo/demoPage";

/** Public landing (spec 10.1), drawn from the recorded smog morning at 6 am. */
export default async function HomePage() {
  return <Landing demo={recordedDemo("smog-morning", 6, "neha")} lang={await currentLang()} />;
}
