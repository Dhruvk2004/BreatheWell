import type { CommunityPage } from "@/view/community";
import { airUnavailable, errorResponse, json, PUBLIC_CACHE, rateLimited } from "../http";
import { loadCommunityPage, type CommunityDeps } from "../community/page";

/**
 * `GET /api/community?lat=..&lon=..&place=..`: public, 20 requests per hour per IP
 * (hashed, in memory). The message in English and Hindi with its source; code inputs only.
 */
export async function communityGet(request: Request, deps: CommunityDeps): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const page: CommunityPage = await loadCommunityPage(params, request.headers, deps);
  if (page.kind === "no_place") return errorResponse(400, "invalid_input", "Send a valid lat and lon.");
  if (page.kind === "rate_limited") return rateLimited(3600);
  if (page.kind === "unavailable") return airUnavailable();
  return json(page, 200, PUBLIC_CACHE);
}
