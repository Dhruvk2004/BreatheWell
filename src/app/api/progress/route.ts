import { tickProgress } from "@/server/handlers/progress";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const POST = (request: Request) => pausedOnQuota(tickProgress(request, appDeps()));
