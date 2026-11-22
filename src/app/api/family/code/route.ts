import { regenerateCode } from "@/server/handlers/code";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const POST = (request: Request) => pausedOnQuota(regenerateCode(request, appDeps()));
