import { lang } from "next/root-params";
import { langOf, type Lang } from "./t";

/** The language of the page being rendered: the `[lang]` root segment the proxy chose (server only). */
export async function currentLang(): Promise<Lang> {
  return langOf(await lang());
}
