import { addDependent } from "@/server/handlers/dependent";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const POST = (request: Request) => pausedOnQuota(addDependent(request, appDeps()));
