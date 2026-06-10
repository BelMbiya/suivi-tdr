export const ROLE_NAMES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "USER"] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const LOCATION_SOURCES = ["WEB", "MOBILE", "IMPORT"] as const;

export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const LOCATION_AREA_STATUSES = [
  "IN_AREA",
  "OUT_OF_AREA",
  "UNKNOWN_AREA",
] as const;

export type LocationAreaStatus = (typeof LOCATION_AREA_STATUSES)[number];

export const GEOFENCE_TYPES = ["CIRCLE", "POLYGON"] as const;

export type GeofenceType = (typeof GEOFENCE_TYPES)[number];

export const GEOFENCE_EVENT_TYPES = ["ENTER", "EXIT"] as const;

export type GeofenceEventType = (typeof GEOFENCE_EVENT_TYPES)[number];

export type CurrentUser = {
  id: string;
  organizationId: string;
  email: string;
  roles: RoleName[];
  areaIds: string[];
};
