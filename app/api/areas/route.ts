import { NextRequest } from "next/server";
import { created, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { areaService } from "@/services/area.service";
import { areaListSchema, createAreaSchema } from "@/validations/areas";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const params = areaListSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await areaService.list(actor, params);
    return ok(result);
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const input = createAreaSchema.parse(await request.json());
    const result = await areaService.create(actor, input);
    return created(result, "Area created");
  });
}
