import type { MetadataRoute } from "next";

/** A real robots.txt: public pages may be crawled; API routes and the auth helper are not. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/__/"] }] };
}
