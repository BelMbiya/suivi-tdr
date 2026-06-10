import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { handleRoute } from "@/lib/route-handler";
import { logService } from "@/services/log.service";
import { auditLogListSchema } from "@/validations/logs";

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const actor = await getCurrentUser();
    const params = auditLogListSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return ok(await logService.auditLogs(actor, params));
  });
}
