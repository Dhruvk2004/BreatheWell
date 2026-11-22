import { communityGet } from "@/server/handlers/community";
import { communityDeps } from "@/server/community/runtime";

/** Gemini's 15 s budget plus the air read (spec 7). */
export const maxDuration = 30;

/** `GET /api/community` (spec 7.6): thin shell over the tested handler. */
export const GET = (request: Request) => communityGet(request, communityDeps());
