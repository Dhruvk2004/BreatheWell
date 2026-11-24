import { loadAir, type AirDeps } from "../air/service";
import { parsePlaceQuery } from "../air/query";
import { airUnavailable, errorResponse, json, PUBLIC_CACHE, rateLimited } from "../http";
import { checkClient, type RateLimiter } from "../rateLimit";

/**
 * `GET /api/air?lat=..&lon=..`: public, no sign-in, 60 requests per hour per IP
 * (hashed, in memory). Returns the grid cell's hourly snapshot; verdicts are computed by the page.
 */
export async function airGet(request: Request, deps: AirDeps, limiter: RateLimiter): Promise<Response> {
  const query = parsePlaceQuery(Object.fromEntries(new URL(request.url).searchParams));
  if (!query) return errorResponse(400, "invalid_input", "Send a valid lat and lon.");
  const limit = checkClient(limiter, request.headers);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  const snapshot = await loadAir(query, deps);
  if (!snapshot) return airUnavailable();
  return json(snapshot, 200, PUBLIC_CACHE);
}
