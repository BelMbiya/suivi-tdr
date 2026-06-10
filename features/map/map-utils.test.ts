import { describe, expect, it } from "vitest";
import {
  appendRouteLocation,
  boundaryToFormValues,
  boundaryToLeafletPositions,
  buildAreaBoundaryFromCenter,
  colorForArea,
  colorForUser,
  enrichMapLocation,
  buildRouteDrawSegments,
  filterMapLocations,
  locationMatchesAreaScope,
  formatLocationTime,
  formatUserLabel,
  latestLocationForUser,
  latestRoutePointPerUser,
  groupRoutesByUser,
  isAreaBoundary,
  mergeRealtimeLocation,
  polygonCentroid,
  type AreaBoundary,
  type MapLocation,
} from "@/features/map/map-utils";

const sampleBoundary: AreaBoundary = {
  type: "Polygon",
  coordinates: [
    [
      [15.3, -4.32],
      [15.32, -4.32],
      [15.32, -4.3],
      [15.3, -4.3],
      [15.3, -4.32],
    ],
  ],
};

const base: MapLocation[] = [
  {
    id: "loc-1",
    userId: "user-1",
    areaId: "area-1",
    latitude: -4.31,
    longitude: 15.31,
    areaStatus: "IN_AREA",
    recordedAt: "2026-06-05T10:00:00.000Z",
    user: { firstName: "Aline", lastName: "Mbala", email: "aline@test.local" },
    area: { id: "area-1", name: "Gombe", code: "GOM" },
  },
  {
    id: "loc-2",
    userId: "user-2",
    areaId: "area-2",
    latitude: -4.35,
    longitude: 15.34,
    areaStatus: "OUT_OF_AREA",
    recordedAt: "2026-06-05T10:01:00.000Z",
    user: { firstName: "Jean", lastName: "Kabasele", email: "jean@test.local" },
    area: { id: "area-2", name: "Limete", code: "LIM" },
  },
];

describe("map realtime utilities", () => {
  it("replaces the previous location for the same user and keeps one marker per user", () => {
    const result = mergeRealtimeLocation(base, {
      ...base[0],
      id: "loc-3",
      latitude: -4.32,
    });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("loc-3");
    expect(result.filter((item) => item.userId === "user-1")).toHaveLength(1);
  });

  it("keeps the user identity when a realtime payload omits user details", () => {
    const result = mergeRealtimeLocation(base, {
      id: "loc-3",
      userId: "user-1",
      areaId: "area-1",
      latitude: -4.32,
      longitude: 15.31,
      areaStatus: "IN_AREA",
      recordedAt: "2026-06-05T10:02:00.000Z",
    });

    expect(result[0].user?.firstName).toBe("Aline");
    expect(formatUserLabel(result[0])).toBe("Aline Mbala");
  });

  it("uses the last route point per user for live display", () => {
    const latest = latestRoutePointPerUser([
      ...base,
      {
        id: "loc-4",
        userId: "user-1",
        areaId: "area-1",
        latitude: -4.33,
        longitude: 15.32,
        areaStatus: "OUT_OF_AREA",
        recordedAt: "2026-06-05T10:05:00.000Z",
        receivedAt: "2026-06-05T10:05:02.000Z",
      },
    ]);

    expect(latest).toHaveLength(2);
    expect(latest.find((item) => item.userId === "user-1")?.id).toBe("loc-4");
  });

  it("returns the newest point for a user across routes and markers", () => {
    const latest = latestLocationForUser("user-1", base, [
      ...base,
      {
        id: "loc-4",
        userId: "user-1",
        areaId: "area-1",
        latitude: -4.33,
        longitude: 15.32,
        areaStatus: "OUT_OF_AREA",
        recordedAt: "2026-06-05T10:05:00.000Z",
        receivedAt: "2026-06-05T10:05:01.000Z",
      },
    ]);

    expect(latest?.id).toBe("loc-4");
    expect(formatLocationTime(latest!)).toContain("05");
  });

  it("falls back to the user directory when realtime payloads have no user block", () => {
    const enriched = enrichMapLocation(
      {
        id: "loc-9",
        userId: "user-9",
        latitude: -4.33,
        longitude: 15.33,
        areaStatus: "OUT_OF_AREA",
        recordedAt: "2026-06-05T10:03:00.000Z",
      },
      [],
      {
        "user-9": {
          firstName: "Patrick",
          lastName: "Ilunga",
          email: "patrick@test.local",
        },
      },
    );

    expect(formatUserLabel(enriched)).toBe("Patrick Ilunga");
  });

  it("filters locations by search across user name, email, area and status", () => {
    expect(filterMapLocations(base, { search: "aline" })).toHaveLength(1);
    expect(filterMapLocations(base, { search: "mbala" })).toHaveLength(1);
    expect(filterMapLocations(base, { search: "Jean Kabasele" })).toHaveLength(1);
    expect(filterMapLocations(base, { search: "lim" })).toHaveLength(1);
    expect(filterMapLocations(base, { search: "out_of_area" })).toHaveLength(1);
  });

  it("filters locations by area", () => {
    const result = filterMapLocations(base, { areaId: "area-2" });

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user-2");
  });

  it("draws a fallback route only when a single GPS point exists", () => {
    const area = {
      id: "area-1",
      name: "Zone A",
      code: "AREA-001",
      boundary: sampleBoundary,
    };
    const route = [
      {
        ...base[0],
        id: "loc-a",
        latitude: -4.3197,
        longitude: 15.2832,
        areaStatus: "OUT_OF_AREA",
      },
    ];

    const segments = buildRouteDrawSegments({
      route,
      userId: "user-1",
      areas: [area],
      assignedAreaId: "area-1",
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].positions).toHaveLength(2);
    expect(segments[0].areaStatus).toBe("OUT_OF_AREA");
  });

  it("keeps the full GPS breadcrumb trail when points differ", () => {
    const route = [
      { ...base[0], id: "loc-a", latitude: -4.32, longitude: 15.28 },
      { ...base[0], id: "loc-b", latitude: -4.321, longitude: 15.281 },
      { ...base[0], id: "loc-c", latitude: -4.322, longitude: 15.282 },
    ];

    const segments = buildRouteDrawSegments({
      route,
      userId: "user-1",
      areas: [],
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].positions).toHaveLength(3);
  });

  it("keeps assigned users visible even when a point is tagged to another area", () => {
    const assignedUserIds = new Set(["user-1"]);
    const crossAreaPoint = {
      ...base[0],
      id: "loc-cross",
      areaId: "area-99",
    };

    expect(
      locationMatchesAreaScope(crossAreaPoint, "area-1", assignedUserIds),
    ).toBe(true);
    expect(
      filterMapLocations([crossAreaPoint], {
        areaId: "area-1",
        assignedUserIds,
      }),
    ).toHaveLength(1);
  });

  it("combines search and area filters", () => {
    expect(filterMapLocations(base, { search: "aline", areaId: "area-2" })).toHaveLength(0);
    expect(filterMapLocations(base, { search: "jean", areaId: "area-2" })).toHaveLength(1);
  });

  it("appends route updates once and keeps route points sorted by recordedAt", () => {
    const late = { ...base[0], id: "loc-late", recordedAt: "2026-06-05T10:05:00.000Z" };
    const early = { ...base[0], id: "loc-early", recordedAt: "2026-06-05T09:55:00.000Z" };
    const route = appendRouteLocation([late], early);
    const duplicate = appendRouteLocation(route, early);

    expect(route.map((item) => item.id)).toEqual(["loc-early", "loc-late"]);
    expect(duplicate).toHaveLength(2);
  });

  it("returns a stable color per user", () => {
    expect(colorForUser("user-1")).toBe(colorForUser("user-1"));
    expect(colorForUser("user-1")).toMatch(/^hsl\(\d+, 78%, 45%\)$/);
  });

  it("converts area boundaries for leaflet and computes centroid", () => {
    expect(isAreaBoundary(sampleBoundary)).toBe(true);
    expect(boundaryToLeafletPositions(sampleBoundary)[0]).toEqual([-4.32, 15.3]);
    expect(polygonCentroid(sampleBoundary)[0]).toBeCloseTo(-4.31, 3);
    expect(polygonCentroid(sampleBoundary)[1]).toBeCloseTo(15.31, 3);
  });

  it("returns a distinct stable color per area", () => {
    expect(colorForArea("area-1")).toBe(colorForArea("area-1"));
    expect(colorForArea("area-1")).toMatch(/^hsl\(\d+, 68%, 40%\)$/);
    expect(colorForArea("area-1")).not.toBe(colorForUser("area-1"));
  });

  it("builds and reads area boundaries from center coordinates", () => {
    const boundary = buildAreaBoundaryFromCenter(-4.325, 15.312, 2);
    const values = boundaryToFormValues(boundary);

    expect(isAreaBoundary(boundary)).toBe(true);
    expect(Number(values.centerLat)).toBeCloseTo(-4.325, 2);
    expect(Number(values.centerLng)).toBeCloseTo(15.312, 2);
    expect(values.radiusUnit).toBe("km");
    expect(Number(values.radius)).toBeCloseTo(2, 1);
  });

  it("displays small radii in meters", () => {
    const boundary = buildAreaBoundaryFromCenter(-4.325, 15.312, 0.05);
    const values = boundaryToFormValues(boundary);

    expect(values.radiusUnit).toBe("m");
    expect(Number(values.radius)).toBeCloseTo(50, 0);
  });

  it("groups route points by user and sorts each group chronologically", () => {
    const groups = groupRoutesByUser([
      { ...base[0], id: "late", recordedAt: "2026-06-05T10:05:00.000Z" },
      { ...base[0], id: "early", recordedAt: "2026-06-05T10:00:00.000Z" },
      base[1],
    ]);

    expect(groups["user-1"].map((item) => item.id)).toEqual(["early", "late"]);
    expect(groups["user-2"]).toHaveLength(1);
  });
});
