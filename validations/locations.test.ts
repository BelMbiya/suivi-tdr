import { describe, expect, it } from "vitest";
import {
  createLocationSchema,
  locationHistorySchema,
  locationListSchema,
} from "@/validations/locations";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("createLocationSchema", () => {
  it("accepts a valid web location payload and defaults source/recordedAt", () => {
    const result = createLocationSchema.parse({
      userId: uuid,
      latitude: -4.325,
      longitude: 15.312,
    });

    expect(result.source).toBe("WEB");
    expect(result.recordedAt).toBeInstanceOf(Date);
  });

  it.each([
    ["latitude below range", { latitude: -91, longitude: 15 }],
    ["latitude above range", { latitude: 91, longitude: 15 }],
    ["longitude below range", { latitude: 0, longitude: -181 }],
    ["longitude above range", { latitude: 0, longitude: 181 }],
    ["negative accuracy", { latitude: 0, longitude: 0, accuracy: -1 }],
    ["battery below range", { latitude: 0, longitude: 0, batteryLevel: -1 }],
    ["battery above range", { latitude: 0, longitude: 0, batteryLevel: 101 }],
    ["heading above range", { latitude: 0, longitude: 0, heading: 361 }],
  ])("rejects %s", (_label, payload) => {
    expect(() =>
      createLocationSchema.parse({
        userId: uuid,
        ...payload,
      }),
    ).toThrow();
  });

  it("rejects invalid source values", () => {
    expect(() =>
      createLocationSchema.parse({
        userId: uuid,
        latitude: 0,
        longitude: 0,
        source: "SATELLITE",
      }),
    ).toThrow();
  });
});

describe("locationListSchema", () => {
  it("accepts map route page sizes up to 2000", () => {
    const result = locationListSchema.parse({
      mode: "all",
      page: "1",
      pageSize: "2000",
      period: "today",
    });

    expect(result.pageSize).toBe(2000);
    expect(result.mode).toBe("all");
  });

  it("rejects page sizes above 2000", () => {
    expect(() =>
      locationListSchema.parse({
        mode: "all",
        pageSize: "2001",
      }),
    ).toThrow();
  });
});

describe("locationHistorySchema", () => {
  it("coerces pagination and date range query params", () => {
    const result = locationHistorySchema.parse({
      userId: uuid,
      from: "2026-06-05T00:00:00.000Z",
      to: "2026-06-06T00:00:00.000Z",
      page: "2",
      pageSize: "50",
    });

    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeInstanceOf(Date);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });

  it("rejects page sizes above the API maximum", () => {
    expect(() =>
      locationHistorySchema.parse({
        userId: uuid,
        from: "2026-06-05T00:00:00.000Z",
        to: "2026-06-06T00:00:00.000Z",
        pageSize: "101",
      }),
    ).toThrow();
  });
});
