import { z } from "zod";
import { isValidCoordinate } from "@/domain/geo/grid";
import { publicPlaceName, safePlaceName } from "@/domain/geo/placeName";

export { safePlaceName };

/** Longest place name kept from the URL (it is only ever shown back as text). */
export const MAX_PLACE_LENGTH = 80;

const coordinate = (min: number, max: number) => z.coerce.number().finite().min(min).max(max);

/**
 * The Air now place in the URL (`/air?place=…&lat=..&lon=..&cc=IN`, spec 10.2): rounded coordinates,
 * a display name and the geocoder's country code. Never a person's name or exact position.
 */
export const placeQuery = z
  .object({
    lat: coordinate(-90, 90),
    lon: coordinate(-180, 180),
    place: z.string().trim().max(MAX_PLACE_LENGTH).optional().transform(publicPlaceName),
    cc: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .optional(),
  })
  .refine((q) => isValidCoordinate(q.lat, q.lon));
export type PlaceQuery = z.infer<typeof placeQuery>;

/** Parses a search-params record (the first value of repeated keys), or null when it is not a place. */
export function parsePlaceQuery(params: Readonly<Record<string, string | string[] | undefined>>): PlaceQuery | null {
  const first = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const parsed = placeQuery.safeParse(first);
  return parsed.success ? parsed.data : null;
}
