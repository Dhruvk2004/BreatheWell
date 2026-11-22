import { requestPlan } from "@/server/handlers/plan";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

/** The 25 s budget counts from the request start; 60 s (the Vercel Hobby limit) leaves room for the save. */
export const maxDuration = 60;

export const POST = (request: Request) => pausedOnQuota(requestPlan(request, appDeps()));
