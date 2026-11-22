import { loadAir, type AirDeps } from "../air/service";
import { parsePlaceQuery } from "../air/query";
import { errorResponse, json, rateLimited } from "../http";
import { checkClient, type RateLimiter } from "../rateLimit";

/** Public air is the same for everyone in a cell, so the CDN may keep it for 10 minutes. */
const PUBLIC_CACHE = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" };

/**
 * `GET /api/air?lat=..&lon=..` (spec 9.1, 11.2): public, no sign-in, 60 requests per hour per IP
 * (hashed, in memory). Returns the grid cell's hourly snapshot; verdicts are computed by the page.
 */
export async function airGet(request: Request, deps: AirDeps, limiter: RateLimiter): Promise<Response> {
  const query = parsePlaceQuery(Object.fromEntries(new URL(request.url).searchParams));
  if (!query) return errorResponse(400, "invalid_input", "Send a valid lat and lon.");
  const limit = checkClient(limiter, request.headers);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  const snapshot = await loadAir(query, deps);
  if (!snapshot) return errorResponse(503, "air_unavailable", "We can't get the air data right now. We won't guess.");
  return json(snapshot, 200, PUBLIC_CACHE);
}
