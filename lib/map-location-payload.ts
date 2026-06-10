import type { MapLocation } from "@/features/map/map-utils";

type LocationWithRelations = {
  id: string;
  organizationId: string;
  userId: string;
  areaId?: string | null;
  latitude: number;
  longitude: number;
  areaStatus: string;
  recordedAt: Date | string;
  receivedAt?: Date | string | null;
  speed?: number | null;
  batteryLevel?: number | null;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  area?: {
    id: string;
    name: string;
    code: string;
  } | null;
};

export function toMapLocationPayload(location: LocationWithRelations): MapLocation & {
  organizationId: string;
} {
  return {
    id: location.id,
    organizationId: location.organizationId,
    userId: location.userId,
    areaId: location.areaId,
    latitude: location.latitude,
    longitude: location.longitude,
    areaStatus: location.areaStatus,
    recordedAt: location.recordedAt,
    receivedAt: location.receivedAt,
    speed: location.speed,
    batteryLevel: location.batteryLevel,
    user: location.user
      ? {
          firstName: location.user.firstName,
          lastName: location.user.lastName,
          email: location.user.email,
        }
      : undefined,
    area: location.area
      ? {
          id: location.area.id,
          name: location.area.name,
          code: location.area.code,
        }
      : null,
  };
}
