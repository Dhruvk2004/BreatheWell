import {
  Ban,
  CircleAlert,
  CircleCheck,
  Cloud,
  CloudFog,
  CloudSun,
  OctagonAlert,
  Smile,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { bandIcon, type Band, type BandIcon } from "@/domain/air/bands";
import type { Verdict } from "@/domain/rules/verdict";

const BAND_ICONS: Readonly<Record<BandIcon, LucideIcon>> = {
  smile: Smile,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "triangle-alert": TriangleAlert,
  "octagon-alert": OctagonAlert,
};

/** The band's icon (domain/air/bands decides which); decorative, the word is always beside it. */
export function BandGlyph({ band, className = "size-5" }: { band: Band; className?: string }) {
  const Icon = BAND_ICONS[bandIcon(band)];
  return <Icon className={className} aria-hidden="true" focusable="false" strokeWidth={2.2} />;
}

const VERDICT_ICONS: Readonly<Record<Verdict, LucideIcon>> = { go: CircleCheck, care: CircleAlert, avoid: Ban };

/** The verdict's icon: check, exclamation, no-entry (design B). */
export function VerdictGlyph({ verdict, className = "size-[1.125em]" }: { verdict: Verdict; className?: string }) {
  const Icon = VERDICT_ICONS[verdict];
  return <Icon className={className} aria-hidden="true" focusable="false" strokeWidth={2.4} />;
}
