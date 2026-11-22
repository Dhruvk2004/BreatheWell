"use client";

import { useRef, useState } from "react";
import { askBreezy, saveAlias } from "@/client/breezy";
import { errorCode } from "@/client/api";
import type { BreezyAnswer } from "@/domain/breezy/answer";
import { cleanQuestion, type Turn } from "@/domain/breezy/question";
import { isEmergency } from "@/domain/safety/emergency";

/**
 * The Breezy thread's state (spec 10.10): the session's turns live only in this browser tab
 * (spec 9.4: chats are not stored). Emergency words get the fixed note at once, even offline. A
 * kin word with no alias pauses the question until the asker picks who they mean; then the alias
 * is saved and the same question is sent.
 */
export type Entry =
  | { readonly id: number; readonly kind: "user"; readonly text: string }
  | { readonly id: number; readonly kind: "answer"; readonly answer: BreezyAnswer; readonly question: string }
  | { readonly id: number; readonly kind: "error"; readonly code: string };

type NewEntry = Entry extends infer E ? (E extends Entry ? Omit<E, "id"> : never) : never;

/** The client waits a little longer than the server's 10 s budget, then aborts and shows the basics. */
export const CLIENT_WAIT_MS = 12_000;

const historyOf = (entries: readonly Entry[]): Turn[] =>
  entries.flatMap((e): Turn[] => {
    if (e.kind === "user") return [{ role: "user", text: e.text }];
    return e.kind === "answer" && e.answer.kind === "reply" ? [{ role: "breezy", text: e.answer.text }] : [];
  });

/** The history without the paused question's own turn, so it is not sent twice. */
function historyBefore(entries: readonly Entry[], question: string): Turn[] {
  const turns = historyOf(entries);
  const last = turns.findLastIndex((t) => t.role === "user" && t.text === question);
  return turns.filter((_, i) => i !== last);
}

/** Asks, and after `CLIENT_WAIT_MS` aborts the request and answers "timeout". */
async function askWithin(question: string, history: readonly Turn[]): Promise<BreezyAnswer | "timeout"> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve("timeout");
    }, CLIENT_WAIT_MS);
  });
  try {
    return await Promise.race([askBreezy(question, history, undefined, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function useBreezy() {
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const next = useRef(0);
  const push = (entry: NewEntry) => setEntries((list) => [...list, { ...entry, id: ++next.current }]);

  const ask = async (question: string, history: readonly Turn[]) => {
    setBusy(true);
    try {
      const answer = await askWithin(question, history);
      push({ kind: "answer", question, answer: answer === "timeout" ? { kind: "basics" } : answer });
    } catch (error) {
      push({ kind: "error", code: errorCode(error) });
    } finally {
      setBusy(false);
    }
  };

  const send = (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;
    const history = historyOf(entries);
    push({ kind: "user", text: question });
    if (isEmergency(cleanQuestion(question))) push({ kind: "answer", question, answer: { kind: "emergency" } });
    else void ask(question, history);
  };

  /** "Papa" → the picked person, saved to the viewer's aliases; then the paused question goes. */
  const pickAlias = async (kin: string, forId: string, question: string): Promise<boolean> => {
    try {
      await saveAlias(kin, forId);
    } catch {
      return false;
    }
    void ask(question, historyBefore(entries, question));
    return true;
  };

  return { entries, busy, send, pickAlias };
}
