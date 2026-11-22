import type { MetadataRoute } from "next";
import { webManifest } from "@/config/manifest";

/** `/manifest.webmanifest` (F24): makes BreatheWell installable; no service worker (spec F24). */
export default function manifest(): MetadataRoute.Manifest {
  return webManifest();
}
