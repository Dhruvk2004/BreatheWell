import { askBreezy } from "@/server/handlers/breezy";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

/** Breezy's 10 s budget plus the air and the family reads. */
export const maxDuration = 30;

export const POST = (request: Request) => pausedOnQuota(askBreezy(request, appDeps()));
