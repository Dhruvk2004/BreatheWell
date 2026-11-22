import { cleanupDeps } from "@/server/cleanup/runtime";
import { cleanupGet } from "@/server/handlers/cleanup";

/** Vercel Cron, once a day (vercel.json): deletes expired documents (spec 9.4). */
export const maxDuration = 60;

export const GET = (request: Request) => cleanupGet(request, cleanupDeps(process.env));
