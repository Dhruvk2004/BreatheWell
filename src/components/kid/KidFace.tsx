import { bandRank, type Band } from "@/domain/air/bands";

const FILL: Readonly<Record<Band, string>> = {
  good: "var(--band-good)",
  satisfactory: "var(--band-satisfactory)",
  moderate: "var(--band-moderate)",
  poor: "var(--band-poor)",
  very_poor: "var(--band-very-poor)",
  severe: "var(--band-severe)",
};

const INK: Readonly<Record<Band, string>> = {
  good: "#FFFFFF",
  satisfactory: "#15232B",
  moderate: "#15232B",
  poor: "#15232B",
  very_poor: "#FFFFFF",
  severe: "#FFFFFF",
};

/** Smile on clean air, flat on Moderate, a gentle down curve after that; never tears (design G). */
const mouth = (band: Band): string => {
  if (bandRank(band) <= bandRank("satisfactory")) return "M23 39c5 5 13 5 18 0";
  if (band === "moderate") return "M24 41h16";
  return "M25 42.5c4.5-1.2 9.5-1.2 14 0";
};

/** The kid card's face in the band colour (design D): colour + the word beside it + this picture. */
export function KidFace({ band, label, className = "size-20" }: { band: Band; label: string; className?: string }) {
  const edge = band === "satisfactory" || band === "moderate" ? "var(--band-edge)" : band === "severe" ? "var(--band-severe-edge)" : "none";
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={label} className={`shrink-0 ${className}`}>
      <circle cx="32" cy="32" r="30" fill={FILL[band]} stroke={edge} strokeWidth="1.5" />
      <circle cx="23" cy="27" r="3.4" fill={INK[band]} />
      <circle cx="41" cy="27" r="3.4" fill={INK[band]} />
      <path d={mouth(band)} fill="none" stroke={INK[band]} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
