"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { addDependent, updateDependent } from "@/client/actions";
import { errorCode } from "@/client/api";
import { translator, type Lang } from "@/i18n/t";
import type { DependentPage } from "@/view/app";
import { dependentBody, dependentDraft, type DependentDraft } from "./dependentDraft";

/** The form's state and Save: add or update through `/api/dependent`, then back to Today. */
export function useDependentForm(page: DependentPage, lang: Lang) {
  const t = translator(lang);
  const router = useRouter();
  const [draft, setDraft] = useState<DependentDraft>(() => dependentDraft(page.input, lang));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<DependentDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    const body = dependentBody(draft);
    if (!body) return setError(t("onb.saveFailed"));
    setBusy(true);
    setError(null);
    try {
      await (page.id ? updateDependent(page.id, body) : addDependent(body));
      router.push("/today");
      router.refresh();
    } catch (failure) {
      const code = errorCode(failure);
      setError(t(code === "too_many" ? "dep.full" : code === "forbidden" ? "dep.forbidden" : "common.error"));
      setBusy(false);
    }
  };
  return { draft, set, tried, busy, error, submit };
}
