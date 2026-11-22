import type { CommunityPage } from "@/view/community";
import { errorResponse, json, rateLimited } from "../http";
import { loadCommunityPage, type CommunityDeps } from "../community/page";

/** The same message for everyone in a cell, so the CDN may keep it for 10 minutes. */
const PUBLIC_CACHE = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" };

/**
 * `GET /api/community?lat=..&lon=..&place=..` (spec 7.6, 11.2): public, 20 requests per hour per IP
 * (hashed, in memory). The message in English and Hindi with its source; code inputs only.
 */
export async function communityGet(request: Request, deps: CommunityDeps): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const page: CommunityPage = await loadCommunityPage(params, request.headers, deps);
  if (page.kind === "no_place") return errorResponse(400, "invalid_input", "Send a valid lat and lon.");
  if (page.kind === "rate_limited") return rateLimited(3600);
  if (page.kind === "unavailable") return errorResponse(503, "air_unavailable", "We can't get the air data right now. We won't guess.");
  return json(page, 200, PUBLIC_CACHE);
}
