import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { InviteView } from "@/components/family/InviteView";
import { PageLoading } from "@/components/shell/PageLoading";
import { SignedInShell } from "@/components/shell/SignedInShell";
import { dayTime } from "@/components/ui/dateTime";
import { INDIA_TIME_ZONE } from "@/domain/time/clock";
import { currentLang } from "@/i18n/server";
import { t } from "@/i18n/t";
import { requireFamily } from "@/server/app/guards";
import { loadInvite } from "@/server/app/invitePages";
import { siteOrigin } from "@/server/app/origin";
import { appDeps } from "@/server/runtime";

export const generateMetadata = async (): Promise<Metadata> => ({ title: t(await currentLang(), "invite.metaTitle") });

/** Invite (spec 10.7): the admin's code, link and QR; others are told who can invite. */
export default function FamilyInvitePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <InviteContent />
    </Suspense>
  );
}

async function InviteContent() {
  const lang = await currentLang();
  const deps = appDeps();
  const page = await loadInvite(await requireFamily("/family/invite"), deps, siteOrigin(deps.appOrigin, await headers()));
  const validTill = page?.expiresAt ? dayTime(page.expiresAt, INDIA_TIME_ZONE, lang) : null;
  return (
    <SignedInShell lang={lang} here="family">
      {page ? <InviteView {...page} validTill={validTill} lang={lang} /> : <p className="m-0 font-bold">{t(lang, "invite.adminOnly")}</p>}
    </SignedInShell>
  );
}
