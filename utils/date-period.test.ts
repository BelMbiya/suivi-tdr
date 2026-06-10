import { describe, expect, it } from "vitest";
import {
  isWithinDateRange,
  resolveLocationPeriodRange,
} from "@/utils/date-period";

describe("date period utilities", () => {
  it("resolves today as start and end of current day", () => {
    const range = resolveLocationPeriodRange("today");
    expect(range.from).toBeDefined();
    expect(range.to).toBeDefined();
    expect(range.from?.getHours()).toBe(0);
    expect(range.to!.getTime() - range.from!.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("returns open range for all dates", () => {
    const range = resolveLocationPeriodRange("all");
    expect(range.from).toBeUndefined();
    expect(range.to).toBeUndefined();
  });

  it("checks whether a timestamp is inside a range", () => {
    const from = new Date("2026-06-05T00:00:00.000Z");
    const to = new Date("2026-06-06T00:00:00.000Z");

    expect(isWithinDateRange("2026-06-05T12:00:00.000Z", { from, to })).toBe(true);
    expect(isWithinDateRange("2026-06-06T00:00:00.000Z", { from, to })).toBe(false);
  });
});
