import type { Band } from "@/domain/air/bands";
import type { Verdict } from "@/domain/rules/verdict";

/** Fill and text for a band (tokens.css; the same in both themes). Light fills get a 1 px edge. */
export const BAND_FILL: Readonly<Record<Band, string>> = {
  good: "bg-band-good text-on-band-good",
  satisfactory: "bg-band-satisfactory text-on-band-satisfactory shadow-[inset_0_0_0_1px_var(--band-edge)]",
  moderate: "bg-band-moderate text-on-band-moderate shadow-[inset_0_0_0_1px_var(--band-edge)]",
  poor: "bg-band-poor text-on-band-poor",
  very_poor: "bg-band-very-poor text-on-band-very-poor",
  severe: "bg-band-severe text-on-band-severe shadow-[0_0_0_1px_var(--band-severe-edge)]",
};

/** A band's colour as a plain background (strip bars, the day edge, legend swatches). */
export const BAND_BG: Readonly<Record<Band, string>> = {
  good: "bg-band-good",
  satisfactory: "bg-band-satisfactory shadow-[inset_0_0_0_1px_var(--band-edge)]",
  moderate: "bg-band-moderate shadow-[inset_0_0_0_1px_var(--band-edge)]",
  poor: "bg-band-poor",
  very_poor: "bg-band-very-poor",
  severe: "bg-band-severe",
};

/** Verdict chips are tinted pills with an outline, never a band colour. */
export const VERDICT_STYLE: Readonly<Record<Verdict, string>> = {
  go: "bg-go-tint text-go",
  care: "bg-care-tint text-care",
  avoid: "bg-avoid-tint text-avoid",
};

/** A bar's height for an AQI on the 0–500 scale, never under 4% so every hour stays visible. */
export const aqiBarHeight = (aqi: number): string => `${Math.max(4, (Math.min(aqi, 500) / 500) * 100)}%`;
