import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { alertService } from "@/services/alert.service";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const areaId = request.nextUrl.searchParams.get("areaId") ?? undefined;
    const alerts = await alertService.list(actor, areaId);
    return ok(alerts);
  });
}
