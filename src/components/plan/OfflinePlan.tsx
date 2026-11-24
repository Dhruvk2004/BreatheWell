"use client";

import { useEffect, useRef } from "react";
import { useOnline } from "@/client/online";
import { SavedPlanCard } from "./SavedPlanCard";

/** True for a plain left click on a link inside the app (the ones that would fail offline). */
function appLinkOf(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  return link instanceof HTMLAnchorElement && link.origin === window.location.origin ? link : null;
}

/**
 * Signed-in pages while the browser is offline: the saved plan at the top of the page, and a
 * tap on an app link stays here and moves focus to the saved plan, instead of the browser's
 * offline error page. Today shows the same state in its own plan slot, so it is skipped there.
 */
export function OfflinePlan() {
  const online = useOnline();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (online) return;
    const stay = (event: MouseEvent) => {
      if (!appLinkOf(event)) return;
      event.preventDefault();
      box.current?.focus();
    };
    document.addEventListener("click", stay, true);
    return () => document.removeEventListener("click", stay, true);
  }, [online]);
  if (online) return null;
  return (
    <div ref={box} tabIndex={-1} role="status" className="mb-5 outline-none">
      <SavedPlanCard />
    </div>
  );
}
