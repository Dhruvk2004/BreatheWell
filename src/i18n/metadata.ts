import type { Metadata } from "next";
import { t, type Lang } from "./t";

/** The site title and description in the page language. */
export function siteMetadata(lang: Lang): Metadata {
  const name = t(lang, "app.name");
  return {
    title: { default: `${name} · ${t(lang, "app.tagline")}`, template: `%s · ${name}` },
    description: t(lang, "app.description"),
  };
}
