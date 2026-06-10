import { NextRequest } from "next/server";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { getRefreshTokenFromRequest } from "@/lib/auth/request-auth";
import { ok } from "@/lib/api-response";
import { handleRoute } from "@/lib/route-handler";
import { authService } from "@/services/auth.service";
import { logoutSchema } from "@/validations/auth";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = logoutSchema.parse(
      await request.json().catch(() => ({})),
    );
    const refreshToken = getRefreshTokenFromRequest(request, body.refreshToken);

    await authService.logout(refreshToken ?? undefined);

    const response = ok(null, "Logout successful");
    clearAuthCookies(response, request);
    return response;
  });
}
