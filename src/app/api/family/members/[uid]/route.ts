import { removeMember } from "@/server/handlers/members";
import { pausedOnQuota } from "@/server/http";
import { appDeps } from "@/server/runtime";

export const DELETE = async (request: Request, ctx: RouteContext<"/api/family/members/[uid]">) =>
  pausedOnQuota(removeMember(request, appDeps(), (await ctx.params).uid));
