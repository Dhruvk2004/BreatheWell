import { describe, expect, it } from "vitest";
import { cityAt, cityGridIds, CITIES, isListedGrid, regionAt } from "@/domain/geo/cities";
import { gridIdOf } from "@/domain/geo/grid";

describe("listed cities (spec 7.6, 8.3)", () => {
  it.each(CITIES.map((c) => [c.id, c] as const))("%s lists its own centre cell and well-formed grid ids", (_, city) => {
    const ids = cityGridIds(city);
    expect(ids).toContain(gridIdOf(city.lat, city.lon));
    expect(ids).toHaveLength((2 * city.cells + 1) ** 2);
    ids.forEach((id) => expect(id).toMatch(/^-?\d+\.\d_-?\d+\.\d$/));
  });

  it("finds Delhi first where NCR cells overlap, and knows the metro cities", () => {
    expect(cityAt(28.56, 77.21)?.id).toBe("delhi");
    expect(cityAt(18.52, 73.86)).toMatchObject({ id: "pune", igp: false, metro: true });
    expect(cityAt(26.14, 91.74)?.metro).toBe(false);
    expect(cityAt(0, 0)).toBeNull();
    expect(isListedGrid("28.6_77.2")).toBe(true);
    expect(isListedGrid("0.0_0.0")).toBe(false);
  });

  it("decides the rule region: listed IGP city, India, or outside India", () => {
    expect(regionAt(28.56, 77.21, null)).toBe("igp");
    expect(regionAt(25.59, 85.14, "IN")).toBe("igp");
    expect(regionAt(18.52, 73.86, null)).toBe("india");
    expect(regionAt(15.3, 74.1, "in")).toBe("india");
    expect(regionAt(27.7, 85.3, "NP")).toBe("outside_india");
    expect(regionAt(20.0, 80.0, null)).toBe("india");
    expect(regionAt(51.5, -0.12, null)).toBe("outside_india");
  });
});
