import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { deviceService } from "@/services/device.service";
import { idSchema } from "@/validations/common";
import { updateDeviceSchema } from "@/validations/devices";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const deviceId = idSchema.parse(id);
    const input = updateDeviceSchema.parse(await request.json());
    return ok(await deviceService.update(actor, deviceId, input), "Device updated");
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const { id } = await params;
    const deviceId = idSchema.parse(id);
    return ok(await deviceService.disable(actor, deviceId), "Device disabled");
  });
}
