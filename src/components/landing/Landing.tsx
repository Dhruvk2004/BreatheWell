import Link from "next/link";
import { translator, type Lang } from "@/i18n/t";
import type { DemoData } from "@/view/demoPage";
import { PlaceFinder } from "../place/PlaceFinder";
import { btn } from "../ui/styles";
import { CommunityInvite, HowItWorks, LandingCards } from "./LandingCards";
import { LandingPreview } from "./LandingPreview";

/**
 * Public landing: the question, the two ways in, the city search, how it works in the brief's
 * words, three cards drawn from the recorded smog morning (`demo`, planned by the page shell) and
 * the community message for a housing society or school. Static: the location and search parts are the only
 * client code.
 */
export function Landing({ demo, lang }: { demo: DemoData; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-8">
      <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <section aria-labelledby="hero" className="grid gap-4">
          <h1 id="hero" className="m-0 text-3xl leading-tight font-bold tracking-tight md:text-[2.75rem]">
            {t("app.tagline")}
          </h1>
          <p className="m-0 max-w-[32em] text-[1.0625em]">{t("app.description")}</p>
          <PlaceFinder lang={lang}>
            <Link href="/demo" className={btn.secondary}>
              {t("landing.cta.demo")}
            </Link>
          </PlaceFinder>
        </section>
        <LandingPreview demo={demo} lang={lang} />
      </div>
      <HowItWorks lang={lang} />
      <LandingCards demo={demo} lang={lang} />
      <CommunityInvite lang={lang} />
      <p className="m-0 text-center text-sm text-ink-muted">{t("landing.trust")}</p>
    </div>
  );
}
