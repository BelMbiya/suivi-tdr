import { NextRequest } from "next/server";
import { created, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { deviceService } from "@/services/device.service";
import { createDeviceSchema, deviceListSchema } from "@/validations/devices";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const params = deviceListSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return ok(await deviceService.list(actor, params));
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const input = createDeviceSchema.parse(await request.json());
    return created(await deviceService.create(actor, input), "Device created");
  });
}
