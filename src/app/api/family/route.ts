import { deleteFamily } from "@/server/handlers/account";
import { createFamily, updateFamily } from "@/server/handlers/family";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const POST = (request: Request) => pausedOnQuota(createFamily(request, appDeps()));
export const PATCH = (request: Request) => pausedOnQuota(updateFamily(request, appDeps()));
export const DELETE = (request: Request) => pausedOnQuota(deleteFamily(request, appDeps()));
