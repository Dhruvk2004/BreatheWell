import { deleteAccount } from "@/server/handlers/account";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const DELETE = (request: Request) => pausedOnQuota(deleteAccount(request, appDeps()));
