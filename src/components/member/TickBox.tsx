"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tickItem, tickProgress } from "@/client/actions";
import type { Lang } from "@/i18n/t";
import { failureText } from "../ui/failure";

type Target = { kind: "plan"; forId: string; key: string } | { kind: "item"; id: string };

/**
 * A done tick (spec 5.7 step 5, 9.1): plan keys go to `/api/progress`, checklist items to
 * `/api/items`. Optimistic, rolled back with an announced message when the save fails.
 */
export function TickBox({ target, label, done, lang }: { target: Target; label: string; done: boolean; lang: Lang }) {
  const router = useRouter();
  const [checked, setChecked] = useState(done);
  const [message, setMessage] = useState("");
  const change = async (next: boolean) => {
    setChecked(next);
    setMessage("");
    try {
      if (target.kind === "plan") await tickProgress(target.forId, target.key, next);
      else await tickItem(target.id, next);
      router.refresh();
    } catch (error) {
      setChecked(!next);
      setMessage(failureText(error, lang, "member.tickFailed", { forbidden: "common.gone" }));
    }
  };
  return (
    <span className="grid gap-1">
      <label className="flex min-h-11 w-max cursor-pointer items-center gap-2.5 font-bold">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => void change(e.target.checked)}
          className="size-5 accent-[var(--color-primary)]"
        />
        {label}
      </label>
      <span role="status" className="text-sm font-bold text-err empty:hidden">
        {message}
      </span>
    </span>
  );
}
