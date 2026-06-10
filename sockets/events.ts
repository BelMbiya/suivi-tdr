import type { MapLocation } from "@/features/map/map-utils";

export type LocationPayload = MapLocation & {
  organizationId: string;
};

export function emitLocationUpdate(payload: LocationPayload) {
  const io = globalThis.socketServer;

  if (!io) {
    return;
  }

  const message: LocationPayload = {
    ...payload,
    recordedAt:
      payload.recordedAt instanceof Date
        ? payload.recordedAt.toISOString()
        : payload.recordedAt,
    receivedAt:
      payload.receivedAt instanceof Date
        ? payload.receivedAt.toISOString()
        : payload.receivedAt,
    user: payload.user
      ? {
          firstName: payload.user.firstName,
          lastName: payload.user.lastName,
          email: payload.user.email,
        }
      : undefined,
    area: payload.area
      ? {
          id: payload.area.id,
          name: payload.area.name,
          code: payload.area.code,
        }
      : null,
  };

  io.to(`org:${message.organizationId}`).emit("location:update", message);

  if (message.areaId) {
    io.to(`area:${message.areaId}`).emit("location:update", message);
  }
}
