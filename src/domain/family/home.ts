import { z } from "zod";
import { gridIdOf, isValidCoordinate, round2 } from "../geo/grid";
import { safePlaceName } from "../geo/placeName";
import type { HomeSetup } from "../libraries/homeSetup";
import { nameSchema } from "../members/names";

/** Home set-up answers. */
export const homeSetupInput = z.strictObject({
  purifier: z.enum(["none", "one_room", "several"]),
  freshAirVent: z.boolean(),
  roadFacing: z.enum(["yes", "no", "not_sure"]),
  fuel: z.enum(["lpg", "electric", "solid"]),
  incense: z.enum(["daily", "sometimes", "never"]),
  indoorSmoking: z.enum(["yes", "no", "prefer_not"]),
}) satisfies z.ZodType<HomeSetup>;

/** The home area as the picker chose it; the server rounds it before storing. */
export const placeInput = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((n) => safePlaceName(n) !== undefined),
    lat: z.number().finite(),
    lon: z.number().finite(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
  })
  .refine((p) => isValidCoordinate(p.lat, p.lon));

export type PlaceInput = z.infer<typeof placeInput>;

export const familyName = nameSchema(40);

/** "Create family": name, home area and home set-up. */
export const familyInput = z.strictObject({ name: familyName, home: placeInput, homeSetup: homeSetupInput });
export type FamilyInput = z.infer<typeof familyInput>;

/** Family settings: any of the three, admin only. */
export const familyPatch = familyInput.partial().refine((p) => Object.keys(p).length > 0);

/** The stored home: place name and coordinates rounded to 2 decimals, plus the 0.1° air cell. */
export interface StoredHome {
  readonly placeName: string;
  readonly lat2: number;
  readonly lon2: number;
  readonly gridId: string;
  readonly countryCode: string | null;
}

/** Rounds the chosen place; the exact position is never stored. */
export function storedHome(place: PlaceInput): StoredHome {
  const { lat2, lon2 } = round2(place.lat, place.lon);
  return { placeName: place.name, lat2, lon2, gridId: gridIdOf(lat2, lon2), countryCode: place.countryCode };
}
