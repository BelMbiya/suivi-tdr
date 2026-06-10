import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/cookies";
import { ok } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { handleRoute } from "@/lib/route-handler";
import { authService } from "@/services/auth.service";
import { loginSchema } from "@/validations/auth";
import { AppError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const body = loginSchema.parse(await request.json());
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0];
    const limit = await rateLimit(`auth:login:${ipAddress ?? "local"}`, 10, 60);

    if (!limit.allowed) {
      throw new AppError("Too many login attempts", 429);
    }

    const result = await authService.login({
      ...body,
      requestInfo: {
        ipAddress,
        userAgent: request.headers.get("user-agent"),
      },
    });

    const response = ok(
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      "Login successful",
    );
    setAuthCookies(response, result, request);
    return response;
  });
}
