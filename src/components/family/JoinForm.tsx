"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { joinFamily } from "@/client/actions";
import { ApiRequestError, errorCode } from "@/client/api";
import { normaliseCode } from "@/domain/family/joinCode";
import { translator, type Lang } from "@/i18n/t";
import { btn } from "../ui/styles";
import { joinMessage, problemOf, type JoinProblem } from "./joinMessages";

function useJoin(initialCode: string, onboarded: boolean) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<JoinProblem | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!normaliseCode(code)) return setProblem({ code: "not_found" });
    setBusy(true);
    try {
      const result = await joinFamily(code);
      router.push(result.kind === "already_member" || onboarded ? "/today" : "/onboarding");
    } catch (error) {
      setProblem(error instanceof ApiRequestError ? problemOf(error.code, error.body) : { code: errorCode(error) });
      setBusy(false);
    }
  };
  return { code, setCode, busy, problem, submit };
}

/**
 * Join with a typed code: auto-uppercase, hyphen optional; the server runs every check
 * and answers in constant time. Errors stay on screen (no timed dismiss) with the way on.
 */
export function JoinForm({ lang, initialCode = "", onboarded }: { lang: Lang; initialCode?: string; onboarded: boolean }) {
  const t = translator(lang);
  const { code, setCode, busy, problem, submit } = useJoin(initialCode, onboarded);
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <CodeField code={code} onChange={setCode} invalid={problem !== null} lang={lang} />
      <p id="join-error" role="alert" className="m-0 flex items-start gap-2 font-bold text-err empty:hidden">
        {problem && <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
        {problem ? joinMessage(problem, lang) : ""}
      </p>
      {problem?.code === "in_other_family" && (
        <Link href="/today" className={`${btn.secondary} w-max`}>
          {t("join.goMine")}
        </Link>
      )}
      <button type="submit" disabled={busy} className={`${btn.primary} disabled:opacity-60`}>
        {busy ? t("common.saving") : t("join.button")}
      </button>
      <Link href="/family/new" className={`${btn.text} w-max`}>
        {t("join.startOwn")}
      </Link>
    </form>
  );
}

function CodeField({ code, onChange, invalid, lang }: { code: string; onChange: (code: string) => void; invalid: boolean; lang: Lang }) {
  const t = translator(lang);
  return (
    <div className="grid gap-1">
      <label htmlFor="join-code" className="text-lg font-bold">
        {t("join.enter")}
      </label>
      <p id="join-hint" className="m-0 text-sm text-ink-muted">
        {t("join.hint")}
      </p>
      <input
        id="join-code"
        value={code}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-describedby={invalid ? "join-hint join-error" : "join-hint"}
        aria-invalid={invalid ? true : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
        className="min-h-12 rounded-xs border-[1.5px] border-rule-strong bg-card px-3.5 font-mono text-xl tracking-[0.1em] uppercase aria-invalid:border-err"
      />
    </div>
  );
}
