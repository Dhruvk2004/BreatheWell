"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { afterSignIn } from "@/client/afterSignIn";
import { signInFailure, type AuthClient, type SignInFailure, type SignInResult } from "@/client/auth";
import { prefersRedirect } from "@/client/inAppBrowser";
import type { Pending } from "@/client/pending";

export type SignInStatus = { kind: "idle" } | { kind: "busy" } | { kind: "failed"; reason: SignInFailure };

/**
 * The sign-in steps for the page (spec 10.4): warm up the SDK, finish a redirect that came back,
 * then popup on desktop or redirect on phones; a blocked popup offers "Continue in this tab".
 */
export function useSignIn(client: AuthClient | null, joinCode: string | null, next: string | null) {
  const router = useRouter();
  const [status, setStatus] = useState<SignInStatus>({ kind: "idle" });
  const finish = useCallback(
    async (result: SignInResult) => {
      if (!result.ok) return setStatus({ kind: "failed", reason: result.reason });
      router.push(await afterSignIn(result.state, result.pending));
    },
    [router],
  );
  useEffect(() => {
    if (!client) return;
    client.preload();
    let active = true;
    void client.completeRedirect().then((result) => {
      if (active && result) {
        setStatus({ kind: "busy" });
        void finish(result);
      }
    });
    return () => {
      active = false;
    };
  }, [client, finish]);
  const pending: Pending = { adultConfirmed: true, joinCode, next };
  const start = async (forceRedirect = false) => {
    if (!client) return;
    setStatus({ kind: "busy" });
    try {
      if (!forceRedirect && !prefersRedirect(navigator.userAgent)) return await finish(await client.popup(pending));
      const failed = await client.redirect(pending);
      if (failed) await finish(failed);
    } catch (error) {
      setStatus({ kind: "failed", reason: signInFailure(error) });
    }
  };
  return { status, start };
}
