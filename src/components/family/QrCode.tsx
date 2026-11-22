"use client";

import { useEffect, useState } from "react";
import { joinQr } from "./qrPath";

/**
 * The join QR (design 10.7): at least 240 px, a 4-module quiet zone, white behind it in both
 * themes, and one accessible name. The generator is loaded only on this screen (spec 11.3).
 */
export function QrCode({ link, label, className = "w-60" }: { link: string; label: string; className?: string }) {
  const [qr, setQr] = useState<{ link: string; size: number; d: string } | null>(null);
  useEffect(() => {
    let active = true;
    void joinQr(link).then((made) => active && setQr({ link, ...made }));
    return () => {
      active = false;
    };
  }, [link]);
  const ready = qr?.link === link ? qr : null;
  const view = ready ? ready.size + 8 : 33;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-4 -4 ${view} ${view}`}
      shapeRendering="crispEdges"
      className={`aspect-square h-auto max-w-full min-w-60 rounded-[12px] bg-white ${className}`}
    >
      {ready && <path d={ready.d} fill="#15232B" />}
    </svg>
  );
}
