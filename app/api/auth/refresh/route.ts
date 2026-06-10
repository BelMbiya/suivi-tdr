import { NextRequest } from "next/server";
import { setAuthCookies } from "@/lib/auth/cookies";
import { getRefreshTokenFromRequest } from "@/lib/auth/request-auth";
import { ok } from "@/lib/api-response";
import { UnauthorizedError } from "@/lib/errors";
import { handleRoute } from "@/lib/route-handler";
import { authService } from "@/services/auth.service";
import { refreshSchema } from "@/validations/auth";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = refreshSchema.parse(
      await request.json().catch(() => ({})),
    );
    const refreshToken = getRefreshTokenFromRequest(request, body.refreshToken);

    if (!refreshToken) {
      throw new UnauthorizedError();
    }

    const result = await authService.refresh(refreshToken, {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0],
      userAgent: request.headers.get("user-agent"),
    });

    const response = ok(
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      "Token refreshed",
    );
    setAuthCookies(response, result, request);
    return response;
  });
}
