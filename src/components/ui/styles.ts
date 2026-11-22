/**
 * Shared class names for the design's buttons, cards and notes (design D), so every page uses the
 * same 44–48 px targets and colours. Band colours never appear here: they are only for air.
 */
const BTN =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-2 px-[1.125em] text-center font-bold leading-tight no-underline";

export const btn = {
  primary: `${BTN} border-transparent bg-brand text-on-brand hover:bg-brand-hover`,
  secondary: `${BTN} border-brand bg-card text-brand hover:bg-brand-tint`,
  /** Destructive verbs in confirm sheets (design D: ink, not the Avoid red). */
  ink: `${BTN} border-transparent bg-ink text-canvas hover:opacity-90`,
  small: "min-h-11 px-[0.875em] text-[0.9375em]",
  text: "inline-flex min-h-11 items-center gap-1 px-1.5 font-bold text-brand underline underline-offset-[3px]",
} as const;

export const card = "grid content-start gap-2 rounded-[16px] border border-rule bg-card p-4";
export const note = "flex items-start gap-2.5 rounded-sm px-3.5 py-3 text-[0.9375em]";
export const noteInfo = `${note} bg-brand-tint`;
export const noteNeutral = `${note} bg-card-2`;
export const h2 = "m-0 text-lg font-bold leading-snug";
export const muted = "text-ink-muted";
export const sourceLine = "m-0 text-sm text-ink-muted";
/** The "written by our AI assistant" line: Monsoon blue is reserved for it (design E note). */
export const aiLine = "m-0 flex items-start gap-1.5 text-sm font-bold text-ai";
export const accordion = "rounded-[12px] border border-rule bg-card px-4";
export const summaryRow =
  "flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden";
export const segment = "inline-flex overflow-hidden rounded-pill border-[1.5px] border-rule-strong";
export const segmentItem =
  "inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-sm font-bold text-ink no-underline aria-[current=true]:bg-ink aria-[current=true]:text-canvas";
