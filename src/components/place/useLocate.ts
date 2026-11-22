"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reverseGeocode } from "@/data/bigDataCloud";
import type { Lang } from "@/domain/time/format";
import { airHref, type ChosenPlace } from "./airHref";

/** idle → asking the browser → finding the place name; "denied" covers refused and unavailable. */
export type LocateState = "idle" | "locating" | "denied";

const TEN_SECONDS = 10_000;

function position(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, { timeout: TEN_SECONDS, maximumAge: 600_000 });
  });
}

/**
 * "Check the air near me" (spec 5.1 steps 2–4): the browser's location → BigDataCloud's place
 * name (rounded coordinates, no name sent) → Air now. Denied or unavailable → `denied`, and the
 * caller moves focus to the city search. No retry loop.
 */
export function useLocate(lang: Lang, onDenied: () => void, onFound?: (place: ChosenPlace) => void) {
  const router = useRouter();
  const [state, setState] = useState<LocateState>("idle");
  const locate = async () => {
    setState("locating");
    let coords: GeolocationCoordinates;
    try {
      coords = await position();
    } catch {
      setState("denied");
      onDenied();
      return;
    }
    const at = { lat: coords.latitude, lon: coords.longitude };
    const place = await reverseGeocode(at, lang);
    const name = place.ok ? place.value.name : "";
    const chosen = { name, ...at, countryCode: place.ok ? place.value.countryCode : null };
    if (onFound) {
      setState("idle");
      onFound(chosen);
    } else router.push(airHref(chosen));
  };
  return { state, locate };
}
