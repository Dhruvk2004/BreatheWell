import Link from "next/link";
import { Clock } from "lucide-react";
import { formatCode } from "@/domain/family/joinCode";
import { translator, type Lang } from "@/i18n/t";
import type { InvitePreview } from "@/view/app";
import { GoogleSignIn } from "../auth/GoogleSignIn";
import { NotConfigured, SignInSmallPrint } from "../auth/SignInView";
import { btn, noteNeutral } from "../ui/styles";
import { JoinForm } from "./JoinForm";
import { joinMessage, type JoinProblem } from "./joinMessages";

export interface InviteViewer {
  readonly signedIn: boolean;
  readonly onboarded: boolean;
  /** The viewer's own family, when in one ("You're already in Kulkarni family"). */
  readonly familyName: string | null;
}

interface Props {
  readonly preview: InvitePreview;
  readonly viewer: InviteViewer;
  /** The join error a sign-in came back with (`?error=`), shown once. */
  readonly error: string | null;
  readonly validTill: string | null;
  readonly lang: Lang;
}

/** The names a returned join error may mention: the viewer's own family, or the invite's. */
function returnedProblem(code: string, preview: InvitePreview, viewer: InviteViewer): JoinProblem {
  const invite = preview.kind === "valid" ? preview : null;
  const adminName = preview.kind === "valid" || preview.kind === "expired" ? preview.adminName : undefined;
  const familyName = code === "in_other_family" ? (viewer.familyName ?? "") : invite?.familyName;
  return { code, familyName, adminName };
}

/**
 * `/join/[code]`: the validated family and admin names, the 18+ tick and "Sign in
 * with Google to join" (the code survives the redirect); signed in, the Join button; every error
 * from spec 5.11 with the way on.
 */
export function InvitePreviewView({ preview, viewer, error, validTill, lang }: Props) {
  const t = translator(lang);
  if (preview.kind === "not_configured") return <NotConfigured lang={lang} />;
  const problem = error ? joinMessage(returnedProblem(error, preview, viewer), lang) : null;
  return (
    <div className="mx-auto grid w-full max-w-[30rem] gap-5">
      <h1 className="m-0 text-2xl font-bold">
        {preview.kind === "valid" ? t("join.invited", { admin: preview.adminName, family: preview.familyName }) : t("join.title")}
      </h1>
      {preview.kind === "valid" ? (
        <ValidInvite invite={preview} viewer={viewer} problem={problem} validTill={validTill} lang={lang} />
      ) : (
        <BadInvite preview={preview} viewer={viewer} lang={lang} />
      )}
      {!viewer.signedIn && <SignInSmallPrint lang={lang} />}
    </div>
  );
}

type Valid = Extract<InvitePreview, { kind: "valid" }>;

function ValidInvite({
  invite,
  viewer,
  problem,
  validTill,
  lang,
}: {
  invite: Valid;
  viewer: InviteViewer;
  problem: string | null;
  validTill: string | null;
  lang: Lang;
}) {
  const t = translator(lang);
  return (
    <>
      <p className="m-0">{t("join.invitedBody")}</p>
      {problem && (
        <p role="alert" className="m-0 font-bold text-err">
          {problem}
        </p>
      )}
      {viewer.signedIn ? (
        <JoinForm lang={lang} initialCode={formatCode(invite.code)} onboarded={viewer.onboarded} />
      ) : (
        <GoogleSignIn lang={lang} joinCode={invite.code} buttonLabel={t("auth.joinButton")} />
      )}
      <p className="m-0 text-sm text-ink-muted">{t("join.codeLine", { code: formatCode(invite.code), time: validTill ?? "" })}</p>
    </>
  );
}

/** Expired, not found or rate limited: the reason, then the code field (signed in) or Sign in. */
function BadInvite({ preview, viewer, lang }: { preview: Exclude<InvitePreview, Valid>; viewer: InviteViewer; lang: Lang }) {
  return (
    <>
      <p role="alert" className={`m-0 ${noteNeutral} font-bold`}>
        <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {joinMessage({ code: preview.kind, adminName: preview.kind === "expired" ? preview.adminName : undefined }, lang)}
      </p>
      {viewer.signedIn ? (
        <JoinForm lang={lang} onboarded={viewer.onboarded} />
      ) : (
        <Link href="/sign-in" className={btn.primary}>
          {translator(lang)("shell.signIn")}
        </Link>
      )}
    </>
  );
}
