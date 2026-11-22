import { deleteItem, tickItem } from "@/server/handlers/items";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

type Ctx = RouteContext<"/api/items/[id]">;

export const PATCH = async (request: Request, ctx: Ctx) => pausedOnQuota(tickItem(request, appDeps(), (await ctx.params).id));
export const DELETE = async (request: Request, ctx: Ctx) => pausedOnQuota(deleteItem(request, appDeps(), (await ctx.params).id));
