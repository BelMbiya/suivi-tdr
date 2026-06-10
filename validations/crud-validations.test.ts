import { describe, expect, it } from "vitest";
import { createAreaSchema } from "@/validations/areas";
import { createDeviceSchema } from "@/validations/devices";
import { createGeofenceSchema } from "@/validations/geofences";
import { createUserSchema } from "@/validations/users";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("CRUD validation schemas", () => {
  it("accepts a valid device payload and defaults platform/isActive", () => {
    const result = createDeviceSchema.parse({
      userId: uuid,
      name: "Web Device",
    });

    expect(result.platform).toBe("WEB");
    expect(result.isActive).toBe(true);
  });

  it("rejects a device without userId", () => {
    expect(() => createDeviceSchema.parse({ name: "Device" })).toThrow();
  });

  it("accepts a polygon area boundary", () => {
    const result = createAreaSchema.parse({
      name: "Gombe",
      code: "gombe",
      boundary: {
        type: "Polygon",
        coordinates: [[[15.3, -4.3], [15.4, -4.3], [15.4, -4.2], [15.3, -4.3]]],
      },
    });

    expect(result.code).toBe("GOMBE");
  });

  it("rejects invalid area boundary coordinates", () => {
    expect(() =>
      createAreaSchema.parse({
        name: "Invalid",
        code: "bad",
        boundary: {
          type: "Polygon",
          coordinates: [[[200, -4.3], [15.4, -4.3], [15.4, -4.2], [200, -4.3]]],
        },
      }),
    ).toThrow();
  });

  it("validates circle and polygon geofences", () => {
    expect(
      createGeofenceSchema.parse({
        name: "Circle",
        type: "CIRCLE",
        centerLat: -4.3,
        centerLng: 15.3,
        radiusMeters: 500,
      }).type,
    ).toBe("CIRCLE");
    expect(
      createGeofenceSchema.parse({
        name: "Polygon",
        type: "POLYGON",
        polygon: {
          type: "Polygon",
          coordinates: [[[15.3, -4.3], [15.4, -4.3], [15.4, -4.2], [15.3, -4.3]]],
        },
      }).type,
    ).toBe("POLYGON");
  });

  it("rejects incomplete circle geofences", () => {
    expect(() =>
      createGeofenceSchema.parse({
        name: "Circle",
        type: "CIRCLE",
        centerLat: -4.3,
      }),
    ).toThrow();
  });

  it("accepts a valid user payload with roles and area assignments", () => {
    const result = createUserSchema.parse({
      email: "agent@test.local",
      password: "ChangeMe123!",
      firstName: "Agent",
      lastName: "Test",
      roles: ["USER"],
      areaIds: [uuid],
    });

    expect(result.roles).toEqual(["USER"]);
    expect(result.areaIds).toEqual([uuid]);
  });
});
