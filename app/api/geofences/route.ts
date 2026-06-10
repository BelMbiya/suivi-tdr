import { NextRequest } from "next/server";
import { GeofenceType } from "@/generated/prisma/client";
import { created, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { geofenceService } from "@/services/geofence.service";
import { createGeofenceSchema, geofenceListSchema } from "@/validations/geofences";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const params = geofenceListSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await geofenceService.list(actor, params);
    return ok(result);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const input = createGeofenceSchema.parse(await request.json());
    const result = await geofenceService.create(actor, {
      ...input,
      type: input.type as GeofenceType,
    });
    return created(result, "Geofence created");
  });
}
