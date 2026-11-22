import { leaveFamily } from "@/server/handlers/members";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const POST = (request: Request) => pausedOnQuota(leaveFamily(request, appDeps()));
