import Link from "next/link";
import { Wind } from "lucide-react";
import { translator, type Lang } from "@/i18n/t";
import { aiLine, btn, h2 } from "../ui/styles";

/** "Get a plan for each person in your family" → Sign in · See a sample family (spec 10.2 item 9). */
export function SignInCta({ lang }: { lang: Lang }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="cta-h" className="grid gap-3 rounded-[16px] bg-card-2 p-4">
      <h2 id="cta-h" className={h2}>
        {t("air.cta.title")}
      </h2>
      <p className={aiLine}>
        <Wind className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t("air.cta.ai")}</span>
      </p>
      <Link href="/sign-in" className={`${btn.primary} w-full`}>
        {t("shell.signIn")}
      </Link>
      <Link href="/demo" className={`${btn.secondary} w-full`}>
        {t("landing.cta.demo")}
      </Link>
    </section>
  );
}
