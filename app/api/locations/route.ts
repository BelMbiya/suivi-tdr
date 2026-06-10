import { NextRequest } from "next/server";
import { created, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { locationService } from "@/services/location.service";
import { createLocationSchema, locationListSchema } from "@/validations/locations";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const params = locationListSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result =
      params.mode === "all"
        ? await locationService.list(actor, params)
        : await locationService.latest(actor, params.areaId);
    return ok(result);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const input = createLocationSchema.parse(await request.json());
    const result = await locationService.create(actor, input);
    return created(result, "Location received");
  });
}
