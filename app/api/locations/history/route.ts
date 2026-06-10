import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { locationService } from "@/services/location.service";
import { locationHistorySchema } from "@/validations/locations";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const params = locationHistorySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await locationService.history(actor, params);
    return ok(result);
  });
}
