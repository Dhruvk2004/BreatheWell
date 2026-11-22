"use client";

import { useParams } from "next/navigation";
import { SavedPlanCard } from "@/components/plan/SavedPlanCard";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { langOf } from "@/i18n/t";

/** A page that failed to render (often a weak network): the error panel, then the saved plan (F24). */
export default function ErrorBoundary({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="grid gap-6">
      <ErrorPanel lang={langOf(useParams().lang)} onRetry={retry} />
      <SavedPlanCard />
    </div>
  );
}
