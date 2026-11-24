"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { langOf } from "@/i18n/t";

// Next.js preloads this boundary on every page; the saved-plan reader (and Zod) loads only on an error.
const SavedPlanCard = dynamic(() => import("@/components/plan/SavedPlanCard").then((m) => m.SavedPlanCard), { ssr: false });

/** A page that failed to render (often a weak network): the error panel, then the saved plan. */
export default function ErrorBoundary({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="grid gap-6">
      <ErrorPanel lang={langOf(useParams().lang)} onRetry={retry} />
      <SavedPlanCard />
    </div>
  );
}
