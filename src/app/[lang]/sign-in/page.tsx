import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNext } from "@/client/pending";
import { SignInView } from "@/components/auth/SignInView";
import { PageLoading } from "@/components/shell/PageLoading";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { requireSignedOut } from "@/server/app/guards";
import { signInConfigured } from "@/server/app/viewer";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "auth.metaTitle") });

/** Sign-in (spec 10.4). */
export default function SignInPage({ searchParams }: PageProps<"/[lang]/sign-in">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInContent({ searchParams }: Pick<PageProps<"/[lang]/sign-in">, "searchParams">) {
  await requireSignedOut("/sign-in");
  const { next } = await searchParams;
  return (
    <SignInView
      lang={await currentLang()}
      configured={signInConfigured(appDeps(), process.env)}
      next={safeNext(typeof next === "string" ? next : null)}
    />
  );
}
