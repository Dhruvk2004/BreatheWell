/** Letters (any script), marks, digits, spaces and , . ' ( ) - only: no links, markup or symbols. */
const PLACE_CHARS = /^[\p{L}\p{M}\p{N} ,.'()-]+$/u;
/** "evil.example": a word, a dot and a word with no space reads as a web address. */
const LOOKS_LIKE_DOMAIN = /[\p{L}\p{N}]\.[\p{L}\p{N}]/u;

/**
 * A place name is shown in headings and in shareable messages, so anything that is not plainly a
 * place name is dropped rather than repeated to a WhatsApp group (Air now shows "Near 28.56, 77.21").
 */
export const safePlaceName = (name: string | undefined): string | undefined =>
  name && PLACE_CHARS.test(name) && !LOOKS_LIKE_DOMAIN.test(name) ? name : undefined;

const LONG_NUMBER = /\d{5,}/u;
const MAX_PUBLIC_WORDS = 5;

/**
 * A place name from a public link (`?place=` on Air now and Community), which anyone can craft and
 * the page repeats into WhatsApp share text: also no phone-number-like runs of 5+ digits and at
 * most 5 words, so "Call 9810012345 for free N95" is shown as coordinates (stage 7 PT-7).
 */
export const publicPlaceName = (name: string | undefined): string | undefined => {
  const safe = safePlaceName(name);
  return safe && !LONG_NUMBER.test(safe) && safe.trim().split(/\s+/u).length <= MAX_PUBLIC_WORDS ? safe : undefined;
};
