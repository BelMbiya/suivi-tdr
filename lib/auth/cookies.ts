import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/jwt";

export function isSecureRequest(request?: NextRequest) {
  if (process.env.COOKIE_SECURE === "true") {
    return true;
  }

  if (process.env.COOKIE_SECURE === "false") {
    return false;
  }

  const forwarded = request?.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() === "https";
  }

  return false;
}

const cookieBaseOptions = (request?: NextRequest) => ({
  httpOnly: true,
  secure: isSecureRequest(request),
  sameSite: "lax" as const,
  path: "/",
});

export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
  request?: NextRequest,
) {
  const options = cookieBaseOptions(request);

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...options,
    maxAge: 15 * 60,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...options,
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthCookies(response: NextResponse, request?: NextRequest) {
  const options = cookieBaseOptions(request);

  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...options,
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...options,
    maxAge: 0,
  });
}
