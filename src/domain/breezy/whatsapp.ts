/**
 * Send on WhatsApp (design G `SendOnWhatsApp`): a `wa.me/?text=` link that carries only
 * the item text, the member's name and the adder's name; never a health detail or an air number.
 */
export const WHATSAPP_BASE = "https://wa.me/?text=";

/** The share link for a prepared message. */
export const whatsappLink = (message: string): string => `${WHATSAPP_BASE}${encodeURIComponent(message)}`;
