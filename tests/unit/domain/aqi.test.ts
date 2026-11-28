import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aqiFromPm, subIndex } from "@/domain/air/aqi";
import { BAND_TABLE, bandIcon, bandOfAqi, bandRank, BANDS, displayAqi, stricterBand, worstBand } from "@/domain/air/bands";

describe("CPCB sub-index at every boundary", () => {
  it.each([
    [0, 0],
    [30, 50],
    [31, 51],
    [60, 100],
    [61, 101],
    [90, 200],
    [91, 201],
    [120, 300],
    [121, 301],
    [250, 400],
    [251, 401],
    [380, 500],
    [381, 501],
  ])("PM2.5 %i → %i", (c, aqi) => expect(subIndex("pm25", c)).toBe(aqi));

  it.each([
    [50, 50],
    [51, 51],
    [100, 100],
    [101, 101],
    [250, 200],
    [251, 201],
    [350, 300],
    [351, 301],
    [430, 400],
    [431, 401],
    [510, 500],
    [511, 501],
  ])("PM10 %i → %i", (c, aqi) => expect(subIndex("pm10", c)).toBe(aqi));

  it("interpolates inside a band and rounds the concentration first", () => {
    expect(subIndex("pm25", 208)).toBe(368);
    expect(subIndex("pm25", 30.4)).toBe(50);
    expect(subIndex("pm25", 30.5)).toBe(51);
  });

  it("returns null for missing or invalid values", () => {
    expect(subIndex("pm25", null)).toBeNull();
    expect(subIndex("pm25", -1)).toBeNull();
    expect(subIndex("pm25", Number.NaN)).toBeNull();
  });
});

describe("AQI from PM2.5 and PM10", () => {
  it("takes the higher sub-index and names it", () => {
    expect(aqiFromPm({ pm25: 208, pm10: 380 })).toEqual({ aqi: 368, band: "very_poor", main: "pm25", pm10Missing: false });
    expect(aqiFromPm({ pm25: 84, pm10: 624 })).toMatchObject({ aqi: 501, band: "severe", main: "pm10" });
  });

  it("uses PM2.5 alone when PM10 is missing (flagged), PM10 alone when PM2.5 is", () => {
    expect(aqiFromPm({ pm25: 45, pm10: null })).toMatchObject({ aqi: 75, pm10Missing: true, main: "pm25" });
    expect(aqiFromPm({ pm25: null, pm10: 120 })).toMatchObject({ main: "pm10", pm10Missing: false });
    expect(aqiFromPm({ pm25: null, pm10: null })).toBeNull();
  });

  it("never lowers the AQI when either pollutant rises (property)", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 600, noNaN: true }),
        fc.float({ min: 0, max: 700, noNaN: true }),
        fc.float({ min: 0, max: 50, noNaN: true }),
        (p25, p10, extra) => {
          const base = aqiFromPm({ pm25: p25, pm10: p10 })!.aqi;
          expect(aqiFromPm({ pm25: p25 + extra, pm10: p10 })!.aqi).toBeGreaterThanOrEqual(base);
          expect(aqiFromPm({ pm25: p25, pm10: p10 + extra })!.aqi).toBeGreaterThanOrEqual(base);
        },
      ),
    );
  });

  it("puts every AQI in the band of its own range (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (c) => {
        const result = aqiFromPm({ pm25: c, pm10: null })!;
        const info = BAND_TABLE[bandRank(result.band)];
        expect(result.aqi).toBeGreaterThanOrEqual(info.aqi[0]);
        expect(result.aqi).toBeLessThanOrEqual(c > 380 ? 501 : info.aqi[1]);
      }),
    );
  });
});

describe("band helpers", () => {
  it("maps AQI to bands at the edges", () => {
    expect([0, 50, 51, 100, 101, 200, 201, 300, 301, 400, 401, 500, 501].map(bandOfAqi)).toEqual([
      "good",
      "good",
      "satisfactory",
      "satisfactory",
      "moderate",
      "moderate",
      "poor",
      "poor",
      "very_poor",
      "very_poor",
      "severe",
      "severe",
      "severe",
    ]);
  });

  it("steps stricter, caps at Severe and compares", () => {
    expect(stricterBand("moderate")).toBe("poor");
    expect(stricterBand("severe")).toBe("severe");
    expect(stricterBand("good", 2)).toBe("moderate");
    expect(worstBand(["poor", "moderate"])).toBe("poor");
    expect(worstBand(["good", "severe", "poor"])).toBe("severe");
    expect(worstBand([])).toBeNull();
  });

  it("gives each band a distinct icon and shows 500+", () => {
    expect(new Set(BANDS.map(bandIcon)).size).toBe(6);
    expect(displayAqi(368)).toBe("368");
    expect(displayAqi(501)).toBe("500+");
  });
});
