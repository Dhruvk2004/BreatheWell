import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { InvitePreviewView } from "@/components/family/InvitePreviewView";
import { PageLoading } from "@/components/shell/PageLoading";
import { dayTime } from "@/domain/time/dayTime";
import { INDIA_TIME_ZONE } from "@/domain/time/clock";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { currentViewer } from "@/server/app/guards";
import { loadJoinPage } from "@/server/app/invitePages";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "join.metaTitle") });

/** The invite link `/join/K7PM4QXT` (spec 5.3–5.4, 10.7). */
export default function InvitePage(props: PageProps<"/[lang]/join/[code]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <InviteContent {...props} />
    </Suspense>
  );
}

async function InviteContent({ params, searchParams }: PageProps<"/[lang]/join/[code]">) {
  const lang = await currentLang();
  const [{ code }, { error }] = await Promise.all([params, searchParams]);
  const page = await loadJoinPage(code, await headers(), await currentViewer(), appDeps());
  const validTill = page.expiresAt && dayTime(page.expiresAt, INDIA_TIME_ZONE, lang);
  return (
    <InvitePreviewView
      preview={page.preview}
      viewer={page.viewer}
      error={typeof error === "string" ? error.slice(0, 40) : null}
      validTill={validTill}
      lang={lang}
    />
  );
}
