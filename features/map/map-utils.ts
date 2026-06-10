import { distanceInMeters } from "@/utils/geo";

export type AreaBoundary = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export type MapArea = {
  id: string;
  name: string;
  code: string;
  boundary?: AreaBoundary | null;
};

export type MapUserRef = {
  firstName: string;
  lastName: string;
  email: string;
};

export type MapLocation = {
  id: string;
  userId: string;
  areaId?: string | null;
  latitude: number;
  longitude: number;
  areaStatus: string;
  recordedAt: string | Date;
  receivedAt?: string | Date | null;
  speed?: number | null;
  batteryLevel?: number | null;
  user?: MapUserRef;
  area?: {
    id: string;
    name: string;
    code: string;
  } | null;
};

export type MapUserDirectory = Record<string, MapUserRef>;

export type RouteDrawSegment = {
  userId: string;
  areaStatus: string;
  positions: [number, number][];
};

function hasUserIdentity(user?: MapUserRef | null) {
  return Boolean(user?.firstName?.trim() || user?.lastName?.trim() || user?.email?.trim());
}

export function formatUserLabel(location: MapLocation) {
  const user = location.user;
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  if (fullName) {
    return fullName;
  }

  if (user?.email) {
    return user.email.split("@")[0] ?? user.email;
  }

  return "Utilisateur";
}

export function enrichMapLocation(
  next: MapLocation,
  sources: Array<MapLocation | MapUserRef | undefined | null> = [],
  directory?: MapUserDirectory,
) {
  let user = hasUserIdentity(next.user) ? next.user : undefined;
  let area = next.area?.code || next.area?.name ? next.area : undefined;

  for (const source of sources) {
    if (!source) {
      continue;
    }

    if ("userId" in source) {
      if (!user && source.userId === next.userId && hasUserIdentity(source.user)) {
        user = source.user;
      }

      if (!area) {
        if (source.areaId === next.areaId && source.area) {
          area = source.area;
        } else if (source.userId === next.userId && source.area) {
          area = source.area;
        }
      }
      continue;
    }

    if (!user && hasUserIdentity(source)) {
      user = source;
    }
  }

  if (!user && directory?.[next.userId]) {
    user = directory[next.userId];
  }

  return {
    ...next,
    user,
    area: area ?? next.area ?? null,
  };
}

export function enrichMapLocations(
  locations: MapLocation[],
  directory?: MapUserDirectory,
) {
  return locations.map((location) =>
    enrichMapLocation(
      location,
      locations.filter((item) => item.userId === location.userId),
      directory,
    ),
  );
}

export function mergeLocationFeed(
  current: MapLocation[],
  incoming: MapLocation[],
  directory?: MapUserDirectory,
) {
  const enrichedIncoming = enrichMapLocations(incoming, directory);
  const byId = new Map(current.map((location) => [location.id, location]));

  for (const location of enrichedIncoming) {
    const existing = byId.get(location.id);
    if (existing && routePointTimestamp(existing) > routePointTimestamp(location)) {
      continue;
    }

    byId.set(location.id, enrichMapLocation(location, [existing], directory));
  }

  return Array.from(byId.values()).sort(compareLocationsByTime);
}

export function routePointTimestamp(location: MapLocation) {
  return new Date(location.recordedAt).getTime();
}

export function locationTimestamp(location: MapLocation) {
  const received = location.receivedAt ? new Date(location.receivedAt).getTime() : null;
  const recorded = routePointTimestamp(location);
  return received && received > recorded ? received : recorded;
}

function compareLocationsByTime(a: MapLocation, b: MapLocation) {
  const delta = routePointTimestamp(a) - routePointTimestamp(b);
  if (delta !== 0) {
    return delta;
  }

  return a.id.localeCompare(b.id);
}

export function formatLocationTime(
  location: MapLocation,
  options?: Intl.DateTimeFormatOptions,
) {
  const value = location.receivedAt ?? location.recordedAt;
  return new Date(value).toLocaleString(
    "fr-FR",
    options ?? {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
}

export function latestLocationPerUser(locations: MapLocation[]) {
  const latest = new Map<string, MapLocation>();

  for (const location of locations) {
    const existing = latest.get(location.userId);
    if (!existing || locationTimestamp(location) > locationTimestamp(existing)) {
      latest.set(location.userId, location);
    }
  }

  return Array.from(latest.values());
}

export function latestLocationForUser(
  userId: string,
  locations: MapLocation[],
  routes: MapLocation[] = [],
) {
  const points = [
    ...routes.filter((location) => location.userId === userId),
    ...locations.filter((location) => location.userId === userId),
  ];

  if (!points.length) {
    return null;
  }

  const byId = new Map(points.map((point) => [point.id, point]));
  return Array.from(byId.values()).sort(compareLocationsByTime).at(-1) ?? null;
}

export function latestRoutePointPerUser(locations: MapLocation[]) {
  const groups = groupRoutesByUser(locations);

  return Object.values(groups)
    .map((route) => route.at(-1))
    .filter((location): location is MapLocation => Boolean(location));
}

export function mergeRealtimeLocation(
  current: MapLocation[],
  next: MapLocation,
  directory?: MapUserDirectory,
) {
  const previous = current.find((item) => item.userId === next.userId);
  const enriched = enrichMapLocation(next, [previous, ...current], directory);

  return [enriched, ...current.filter((item) => item.userId !== next.userId)];
}

export function appendRouteLocation(
  current: MapLocation[],
  next: MapLocation,
  directory?: MapUserDirectory,
) {
  const previous = [...current]
    .filter((item) => item.userId === next.userId)
    .sort(compareLocationsByTime)
    .at(-1);
  const enriched = enrichMapLocation(next, [previous, ...current], directory);
  const merged = current.some((item) => item.id === enriched.id)
    ? current.map((item) => (item.id === enriched.id ? enriched : item))
    : [...current, enriched];

  return merged.sort(compareLocationsByTime);
}

export function colorForUser(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = userId.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 78%, 45%)`;
}

export function colorForArea(areaId: string) {
  let hash = 0;

  for (let index = 0; index < areaId.length; index += 1) {
    hash = areaId.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = 200 + (Math.abs(hash) % 70);
  return `hsl(${hue}, 68%, 40%)`;
}

export function boundaryToLeafletPositions(boundary: AreaBoundary) {
  return boundary.coordinates[0].map(([longitude, latitude]) => [latitude, longitude] as [
    number,
    number,
  ]);
}

function polygonRingPoints(boundary: AreaBoundary) {
  const ring = boundary.coordinates[0];
  const last = ring[ring.length - 1];
  const first = ring[0];

  if (last && first && last[0] === first[0] && last[1] === first[1]) {
    return ring.slice(0, -1);
  }

  return ring;
}

export function polygonCentroid(boundary: AreaBoundary): [number, number] {
  const ring = polygonRingPoints(boundary);
  const totals = ring.reduce(
    (accumulator, [longitude, latitude]) => ({
      latitude: accumulator.latitude + latitude,
      longitude: accumulator.longitude + longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return [totals.latitude / ring.length, totals.longitude / ring.length];
}

const KM_PER_DEGREE_LAT = 111.32;

export type RadiusUnit = "m" | "km";

export function radiusFormValueToKm(radius: number, unit: RadiusUnit) {
  return unit === "m" ? radius / 1000 : radius;
}

export function radiusKmToFormValue(radiusKm: number) {
  if (radiusKm < 1) {
    return {
      radius: String(Math.max(1, Math.round(radiusKm * 1000))),
      radiusUnit: "m" as const,
    };
  }

  return {
    radius: radiusKm.toFixed(2),
    radiusUnit: "km" as const,
  };
}

export function formatRadiusLabel(radiusKm: number) {
  const { radius, radiusUnit } = radiusKmToFormValue(radiusKm);
  return `${radius} ${radiusUnit}`;
}

export function buildAreaBoundaryFromCenter(
  latitude: number,
  longitude: number,
  radiusKm: number,
): AreaBoundary {
  const deltaLat = radiusKm / KM_PER_DEGREE_LAT;
  const deltaLng =
    radiusKm / (KM_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180));

  return {
    type: "Polygon",
    coordinates: [
      [
        [longitude - deltaLng, latitude - deltaLat],
        [longitude + deltaLng, latitude - deltaLat],
        [longitude + deltaLng, latitude + deltaLat],
        [longitude - deltaLng, latitude + deltaLat],
        [longitude - deltaLng, latitude - deltaLat],
      ],
    ],
  };
}

export function boundaryToFormValues(boundary: AreaBoundary | null | undefined) {
  if (!isAreaBoundary(boundary)) {
    return {
      centerLat: "-4.325",
      centerLng: "15.312",
      radius: "25",
      radiusUnit: "m" as const,
    };
  }

  const [centerLat, centerLng] = polygonCentroid(boundary);
  const ring = polygonRingPoints(boundary);
  let maxLatDelta = 0;
  let maxLngDelta = 0;

  for (const [longitude, latitude] of ring) {
    maxLatDelta = Math.max(maxLatDelta, Math.abs(latitude - centerLat));
    maxLngDelta = Math.max(maxLngDelta, Math.abs(longitude - centerLng));
  }

  const latRadiusKm = maxLatDelta * KM_PER_DEGREE_LAT;
  const lngRadiusKm =
    maxLngDelta * KM_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);
  const radiusKm = (latRadiusKm + lngRadiusKm) / 2;

  const { radius, radiusUnit } = radiusKmToFormValue(Math.max(0.001, radiusKm));

  return {
    centerLat: centerLat.toFixed(6),
    centerLng: centerLng.toFixed(6),
    radius,
    radiusUnit,
  };
}

export function isAreaBoundary(value: unknown): value is AreaBoundary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const boundary = value as AreaBoundary;
  return (
    boundary.type === "Polygon" &&
    Array.isArray(boundary.coordinates) &&
    boundary.coordinates.length > 0 &&
    Array.isArray(boundary.coordinates[0])
  );
}

export function routeBounds(locations: MapLocation[]) {
  if (!locations.length) {
    return null;
  }

  let minLat = locations[0].latitude;
  let maxLat = locations[0].latitude;
  let minLng = locations[0].longitude;
  let maxLng = locations[0].longitude;

  for (const location of locations) {
    minLat = Math.min(minLat, location.latitude);
    maxLat = Math.max(maxLat, location.latitude);
    minLng = Math.min(minLng, location.longitude);
    maxLng = Math.max(maxLng, location.longitude);
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

export function splitRouteByAreaStatus(route: MapLocation[]) {
  if (!route.length) {
    return [];
  }

  const segments: { areaStatus: string; points: MapLocation[] }[] = [];
  let currentStatus = route[0].areaStatus;
  let currentPoints: MapLocation[] = [route[0]];

  for (const point of route.slice(1)) {
    if (point.areaStatus !== currentStatus) {
      segments.push({
        areaStatus: currentStatus,
        points: [...currentPoints, point],
      });
      currentStatus = point.areaStatus;
      currentPoints = [point];
      continue;
    }

    currentPoints.push(point);
  }

  if (currentPoints.length) {
    segments.push({ areaStatus: currentStatus, points: currentPoints });
  }

  return segments;
}

export function groupRoutesByUser(locations: MapLocation[]) {
  const groups = locations.reduce<Record<string, MapLocation[]>>((groups, location) => {
    groups[location.userId] = [...(groups[location.userId] ?? []), location];
    return groups;
  }, {});

  for (const userId of Object.keys(groups)) {
    groups[userId] = groups[userId].sort(compareLocationsByTime);
  }

  return groups;
}

export function toMapCoordinate(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function toLatLng(location: MapLocation): [number, number] | null {
  const latitude = toMapCoordinate(location.latitude);
  const longitude = toMapCoordinate(location.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return [latitude, longitude];
}

export function routePolylinePositions(
  route: MapLocation[],
  minDistanceMeters = 0,
): [number, number][] {
  const positions: [number, number][] = [];

  for (const location of route) {
    const next = toLatLng(location);
    if (!next) {
      continue;
    }

    const previous = positions.at(-1);
    if (previous) {
      const gap = distanceInMeters(
        { latitude: previous[0], longitude: previous[1] },
        { latitude: next[0], longitude: next[1] },
      );

      if (minDistanceMeters > 0 && gap < minDistanceMeters) {
        continue;
      }

      if (gap < 0.5) {
        continue;
      }
    }

    positions.push(next);
  }

  return positions;
}

export async function snapPositionsToRoad(
  positions: [number, number][],
): Promise<[number, number][]> {
  if (positions.length < 2) {
    return positions;
  }

  try {
    const coordinatePath = positions
      .map(([latitude, longitude]) => `${longitude},${latitude}`)
      .join(";");

    const response = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${coordinatePath}?overview=full&geometries=geojson`,
    );

    if (!response.ok) {
      return positions;
    }

    const payload = (await response.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const geometry = payload.routes?.[0]?.geometry?.coordinates;

    if (!Array.isArray(geometry) || geometry.length < 2) {
      return positions;
    }

    return geometry.map(([longitude, latitude]) => [latitude, longitude]);
  } catch {
    return positions;
  }
}

export function resolveAssignedAreaCentroid(
  areas: MapArea[],
  areaId?: string | null,
): [number, number] | null {
  if (!areaId) {
    return null;
  }

  const area = areas.find((item) => item.id === areaId);
  if (!area || !isAreaBoundary(area.boundary)) {
    return null;
  }

  return polygonCentroid(area.boundary);
}

export function buildRouteDrawSegments(params: {
  route: MapLocation[];
  userId: string;
  areas: MapArea[];
  assignedAreaId?: string | null;
}): RouteDrawSegment[] {
  const { route, userId, areas, assignedAreaId } = params;

  if (!route.length) {
    return [];
  }

  const drawn: RouteDrawSegment[] = [];

  for (const segment of splitRouteByAreaStatus(route)) {
    const positions = routePolylinePositions(segment.points);
    if (positions.length >= 2) {
      drawn.push({
        userId,
        areaStatus: segment.areaStatus,
        positions,
      });
    }
  }

  if (drawn.length > 0) {
    return drawn;
  }

  const allPositions = routePolylinePositions(route);
  if (allPositions.length >= 2) {
    return [
      {
        userId,
        areaStatus: route.at(-1)?.areaStatus ?? "UNKNOWN_AREA",
        positions: allPositions,
      },
    ];
  }

  const lastPoint = toLatLng(route.at(-1)!);
  if (!lastPoint) {
    return [];
  }

  const fallbackStart =
    resolveAssignedAreaCentroid(areas, assignedAreaId ?? route[0]?.areaId) ??
    toLatLng(route[0]!);

  if (
    fallbackStart &&
    (fallbackStart[0] !== lastPoint[0] || fallbackStart[1] !== lastPoint[1])
  ) {
    return [
      {
        userId,
        areaStatus: route.at(-1)?.areaStatus ?? "OUT_OF_AREA",
        positions: [fallbackStart, lastPoint],
      },
    ];
  }

  return [];
}

export function routesSignature(locations: MapLocation[]) {
  return locations
    .map((location) => {
      const latitude = toMapCoordinate(location.latitude);
      const longitude = toMapCoordinate(location.longitude);
      return `${location.id}:${latitude}:${longitude}:${routePointTimestamp(location)}`;
    })
    .join("|");
}

function locationSearchFields(location: MapLocation) {
  const firstName = location.user?.firstName ?? "";
  const lastName = location.user?.lastName ?? "";

  return [
    firstName,
    lastName,
    `${firstName} ${lastName}`.trim(),
    `${lastName} ${firstName}`.trim(),
    location.user?.email,
    location.area?.name,
    location.area?.code,
    location.areaStatus,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
}

export function locationMatchesAreaScope(
  location: MapLocation,
  areaId?: string,
  assignedUserIds?: ReadonlySet<string>,
) {
  if (!areaId) {
    return true;
  }

  if (location.areaId === areaId) {
    return true;
  }

  return assignedUserIds?.has(location.userId) ?? false;
}

export function filterMapLocations(
  locations: MapLocation[],
  filters: {
    search?: string;
    areaId?: string;
    assignedUserIds?: ReadonlySet<string>;
  },
) {
  const terms = filters.search
    ?.trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return locations.filter((location) => {
    const matchesArea = locationMatchesAreaScope(
      location,
      filters.areaId,
      filters.assignedUserIds,
    );

    if (!terms?.length) {
      return matchesArea;
    }

    const fields = locationSearchFields(location);
    const matchesSearch = terms.every((term) =>
      fields.some((field) => field.includes(term)),
    );

    return matchesArea && matchesSearch;
  });
}
