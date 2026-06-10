import { describe, expect, it } from "vitest";
import { distanceInMeters, totalDistanceInMeters } from "@/utils/geo";

describe("geo utilities", () => {
  it("returns zero distance for identical coordinates", () => {
    expect(
      distanceInMeters(
        { latitude: -4.325, longitude: 15.312 },
        { latitude: -4.325, longitude: 15.312 },
      ),
    ).toBe(0);
  });

  it("computes approximate distance between two coordinates", () => {
    const distance = distanceInMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );

    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(112_000);
  });

  it("sums a route distance across all consecutive points", () => {
    const distance = totalDistanceInMeters([
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 0, longitude: 2 },
    ]);

    expect(distance).toBeGreaterThan(222_000);
    expect(distance).toBeLessThan(224_000);
  });

  it("returns zero for empty and single-point routes", () => {
    expect(totalDistanceInMeters([])).toBe(0);
    expect(totalDistanceInMeters([{ latitude: 0, longitude: 0 }])).toBe(0);
  });
});
