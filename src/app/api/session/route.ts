import { createSession, deleteSession } from "@/server/handlers/session";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const POST = (request: Request) => pausedOnQuota(createSession(request, appDeps()));
export const DELETE = (request: Request) => pausedOnQuota(deleteSession(request, appDeps()));
