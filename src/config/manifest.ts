import type { MetadataRoute } from "next";
import { t } from "@/i18n/t";

/**
 * The web app manifest (F24): name, colours from the brand palette and the install icons rendered
 * by `npm run icons`. English is the manifest language; the app itself follows the saved language.
 */
export function webManifest(): MetadataRoute.Manifest {
  return {
    name: t("en", "app.name"),
    short_name: t("en", "app.name"),
    description: t("en", "app.description"),
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F4F7F8",
    theme_color: "#0B5E7A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
