import { saveProfile } from "@/server/handlers/profile";
import { appDeps } from "@/server/runtime";
import { pausedOnQuota } from "@/server/http";

export const PUT = (request: Request) => pausedOnQuota(saveProfile(request, appDeps()));
