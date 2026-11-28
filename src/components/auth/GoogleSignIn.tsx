"use client";

import { RefreshCw, Users } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { browserAuthClient } from "@/client/authRuntime";
import type { AuthClient } from "@/client/auth";
import { isInAppBrowser } from "@/client/inAppBrowser";
import { translator, type Lang } from "@/i18n/t";
import { btn, noteInfo } from "../ui/styles";
import { AdultTick } from "./AdultTick";
import { InAppScreen } from "./InAppScreen";
import { useSignIn, type SignInStatus } from "./useSignIn";

interface GoogleSignInProps {
  readonly lang: Lang;
  readonly joinCode?: string | null;
  readonly next?: string | null;
  readonly buttonLabel: string;
  readonly children?: ReactNode;
  /** Tests pass a client; the page uses the browser's. */
  readonly client?: AuthClient | null;
}

const noop = () => () => undefined;
const userAgent = () => navigator.userAgent;

/**
 * The adult tick and Google sign-in: Continue stays disabled until the
 * tick, with the reason written next to it; "I'm under 18" explains and signs nothing in; an
 * in-app browser gets Open in Chrome instead; a failed sign-in says so and offers Try again.
 */
export function GoogleSignIn({ lang, joinCode = null, next = null, buttonLabel, children, client }: GoogleSignInProps) {
  const t = translator(lang);
  const ua = useSyncExternalStore(noop, userAgent, () => "");
  const auth = client === undefined ? (typeof window === "undefined" ? null : browserAuthClient()) : client;
  const [adult, setAdult] = useState(false);
  const [under18, setUnder18] = useState(false);
  const { status, start } = useSignIn(auth, joinCode, next);
  if (isInAppBrowser(ua)) return <InAppScreen lang={lang} href={window.location.href} userAgent={ua} />;
  if (under18) return <Under18 lang={lang} onBack={() => setUnder18(false)} />;
  return (
    <div className="grid gap-4">
      {children}
      <AdultTick checked={adult} onChange={setAdult} lang={lang} />
      <button
        type="button"
        disabled={!adult || status.kind === "busy"}
        aria-describedby={adult ? undefined : "tick-first"}
        onClick={() => void start()}
        className={`${btn.primary} disabled:opacity-60`}
      >
        {buttonLabel}
      </button>
      {!adult && (
        <p id="tick-first" className="m-0 -mt-2 text-sm text-ink-muted">
          {t("auth.tickFirst")}
        </p>
      )}
      <StatusLine status={status} onRedirect={() => void start(true)} lang={lang} />
      <button type="button" onClick={() => setUnder18(true)} className={`${btn.text} w-max`}>
        {t("auth.under18")}
      </button>
    </div>
  );
}

/** "Signing in…", or a failed sign-in with Try again; a blocked popup offers the same tab. */
function StatusLine({ status, onRedirect, lang }: { status: SignInStatus; onRedirect: () => void; lang: Lang }) {
  const t = translator(lang);
  return (
    <>
      <p role="status" className="m-0 font-bold empty:hidden">
        {status.kind === "busy" ? t("auth.signingIn") : ""}
      </p>
      {status.kind === "failed" && (
        <p role="alert" className={`m-0 ${noteInfo}`}>
          <RefreshCw className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
          <span className="grid gap-2">
            {t(status.reason === "popup_blocked" ? "auth.popupBlocked" : "auth.failed")}
            {status.reason === "popup_blocked" && (
              <button type="button" onClick={onRedirect} className={`${btn.secondary} ${btn.small} w-max`}>
                {t("auth.inTab")}
              </button>
            )}
          </span>
        </p>
      )}
    </>
  );
}

function Under18({ lang, onBack }: { lang: Lang; onBack: () => void }) {
  const t = translator(lang);
  return (
    <section aria-labelledby="under18-h" className="grid gap-3 rounded-[16px] bg-brand-tint p-4">
      <h2 id="under18-h" className="m-0 flex items-center gap-2 text-lg font-bold">
        <Users className="size-5 text-brand" aria-hidden="true" />
        {t("auth.under18Title")}
      </h2>
      <p className="m-0">{t("auth.under18Body")}</p>
      {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the form was replaced by this note; focus moves to its only control */}
      <button type="button" autoFocus onClick={onBack} className={`${btn.secondary} ${btn.small} w-max`}>
        {t("common.back")}
      </button>
    </section>
  );
}
