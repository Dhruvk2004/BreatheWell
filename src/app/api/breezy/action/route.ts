import { breezyAction } from "@/server/handlers/breezyAction";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

/** A confirmed Breezy card (spec 7.7.4): thin shell over the tested handler. */
export const POST = (request: Request) => pausedOnQuota(breezyAction(request, appDeps()));
