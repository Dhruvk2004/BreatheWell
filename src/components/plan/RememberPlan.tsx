"use client";

import { useEffect } from "react";
import { savePlan, type SavedPlan } from "@/client/savedPlan";

/** Keeps the plan Today just rendered in this browser, for the offline "Saved plan" (F24). Renders nothing. */
export function RememberPlan({ plan }: { plan: SavedPlan }) {
  const text = JSON.stringify(plan);
  useEffect(() => {
    savePlan(JSON.parse(text) as SavedPlan);
  }, [text]);
  return null;
}
