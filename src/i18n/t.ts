import type { Lang } from "@/domain/time/format";
import en from "./en.json";
import hi from "./hi.json";

export { isLang, langOf, LANGS, type Lang } from "@/domain/time/format";

/** Every UI string key; `hi.json` must have exactly the same keys (tested). */
export type MessageKey = keyof typeof en;

const MESSAGES: Readonly<Record<Lang, Readonly<Record<MessageKey, string>>>> = { en, hi };

/**
 * The UI string for a key in a language, with `{name}` placeholders filled. A missing variable is
 * left as `{name}` so a gap shows up in review rather than as an empty string.
 */
export function t(lang: Lang, key: MessageKey, vars: Readonly<Record<string, string | number>> = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** A translator bound to one language. */
export const translator =
  (lang: Lang) =>
  (key: MessageKey, vars?: Readonly<Record<string, string | number>>): string =>
    t(lang, key, vars);
