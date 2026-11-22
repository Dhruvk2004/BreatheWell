import { deleteDependent, updateDependent } from "@/server/handlers/dependent";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

type Ctx = RouteContext<"/api/dependent/[id]">;

export const PUT = async (request: Request, ctx: Ctx) => pausedOnQuota(updateDependent(request, appDeps(), (await ctx.params).id));
export const DELETE = async (request: Request, ctx: Ctx) => pausedOnQuota(deleteDependent(request, appDeps(), (await ctx.params).id));
