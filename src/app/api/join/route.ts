import { joinFamily } from "@/server/handlers/join";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const POST = (request: Request) => pausedOnQuota(joinFamily(request, appDeps()));
