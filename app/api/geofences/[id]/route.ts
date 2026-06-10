import { NextRequest } from "next/server";
import { GeofenceType } from "@/generated/prisma/client";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { geofenceService } from "@/services/geofence.service";
import { idSchema } from "@/validations/common";
import { updateGeofenceSchema } from "@/validations/geofences";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const geofenceId = idSchema.parse(id);
    const input = updateGeofenceSchema.parse(await request.json());
    const result = await geofenceService.update(actor, geofenceId, {
      ...input,
      type: input.type as GeofenceType | undefined,
    });
    return ok(result, "Geofence updated");
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const geofenceId = idSchema.parse(id);
    const result = await geofenceService.delete(actor, geofenceId);
    return ok(result, "Geofence disabled");
  });
}
