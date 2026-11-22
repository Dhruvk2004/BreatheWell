import { saveAlias } from "@/server/handlers/aliases";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

/** The viewer's own name aliases (spec 7.7.9): thin shell over the tested handler. */
export const PUT = (request: Request) => pausedOnQuota(saveAlias(request, appDeps()));
