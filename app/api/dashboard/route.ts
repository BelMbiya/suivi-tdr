import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { dashboardService } from "@/services/dashboard.service";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const result = await dashboardService.overview(
      actor,
      request.nextUrl.searchParams.get("areaId") ?? undefined,
    );
    return ok(result);
  });
}
