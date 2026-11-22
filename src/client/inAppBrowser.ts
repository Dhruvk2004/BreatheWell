/**
 * In-app browsers block Google sign-in with `disallowed_useragent` (spec 10.4, 5.11): Instagram,
 * Facebook, some WhatsApp and Google Lens flows, and Android WebViews. Detected from the user
 * agent before the button, so no sign-in is ever attempted there.
 */
const IN_APP = /\b(FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|GSA\/|LinkedInApp)\b|; wv\)/i;

export const isInAppBrowser = (userAgent: string): boolean => IN_APP.test(userAgent);

export const isAndroid = (userAgent: string): boolean => /Android/i.test(userAgent);

/** "Open in Chrome" on Android: an intent link for the same page; elsewhere the page itself. */
export function openInChromeHref(href: string, userAgent: string): string {
  if (!isAndroid(userAgent)) return href;
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;end`;
}

/** Popup on desktop, redirect on phones and tablets (spec F5). */
export const prefersRedirect = (userAgent: string): boolean => /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
