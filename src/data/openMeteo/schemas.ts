import { z } from "zod";

const series = z.array(z.number().nullable());

/** Fields every Open-Meteo hourly response has. */
const base = {
  latitude: z.number(),
  longitude: z.number(),
  utc_offset_seconds: z.number(),
  timezone: z.string(),
};

/** Open-Meteo Air Quality API, hourly only (the API has no daily variables, spec F2). */
export const airQualityResponse = z.object({
  ...base,
  hourly: z
    .object({
      time: z.array(z.string()),
      pm2_5: series,
      pm10: series,
      nitrogen_dioxide: series,
      ozone: series,
      carbon_monoxide: series,
      sulphur_dioxide: series,
    })
    .refine(
      (h) => [h.pm2_5, h.pm10, h.nitrogen_dioxide, h.ozone, h.carbon_monoxide, h.sulphur_dioxide].every((s) => s.length === h.time.length),
      {
        message: "every series must match the time axis",
      },
    ),
});
export type AirQualityResponse = z.infer<typeof airQualityResponse>;

/** Open-Meteo Forecast or Archive API, hourly wind, temperature and humidity. */
export const weatherResponse = z.object({
  ...base,
  hourly: z
    .object({ time: z.array(z.string()), temperature_2m: series, relative_humidity_2m: series, wind_speed_10m: series })
    .refine((h) => [h.temperature_2m, h.relative_humidity_2m, h.wind_speed_10m].every((s) => s.length === h.time.length), {
      message: "every series must match the time axis",
    }),
});
export type WeatherResponse = z.infer<typeof weatherResponse>;

/** Open-Meteo Geocoding API search. `results` is absent when nothing matches. */
export const geocodeResponse = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        country_code: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});
export type GeocodeResponse = z.infer<typeof geocodeResponse>;
