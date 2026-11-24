/** The family's home set-up, stored in `families/{fid}/private/home`. */
export interface HomeSetup {
  readonly purifier: "none" | "one_room" | "several";
  readonly freshAirVent: boolean;
  readonly roadFacing: "yes" | "no" | "not_sure";
  readonly fuel: "lpg" | "electric" | "solid";
  readonly incense: "daily" | "sometimes" | "never";
  readonly indoorSmoking: "yes" | "no" | "prefer_not";
}

/** True when the home has a purifier in at least one room. */
export const hasPurifier = (home: HomeSetup): boolean => home.purifier !== "none";
