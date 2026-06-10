import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/jwt";

function bearerToken(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function getAccessToken() {
  const headerStore = await headers();
  const fromHeader = bearerToken(headerStore.get("authorization"));

  if (fromHeader) {
    return fromHeader;
  }

  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export function getAccessTokenFromRequest(request: NextRequest) {
  const fromHeader = bearerToken(request.headers.get("authorization"));

  if (fromHeader) {
    return fromHeader;
  }

  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getRefreshToken() {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export function getRefreshTokenFromRequest(
  request: NextRequest,
  bodyRefreshToken?: string | null,
) {
  if (bodyRefreshToken?.trim()) {
    return bodyRefreshToken.trim();
  }

  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}
