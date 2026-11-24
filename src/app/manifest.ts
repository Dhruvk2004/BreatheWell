import type { MetadataRoute } from "next";
import { webManifest } from "@/config/manifest";

/** `/manifest.webmanifest`: makes BreatheWell installable; no service worker. */
export default function manifest(): MetadataRoute.Manifest {
  return webManifest();
}
