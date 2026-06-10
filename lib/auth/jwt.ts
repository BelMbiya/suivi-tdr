import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import type { CurrentUser } from "@/types/domain";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export const ACCESS_TOKEN_COOKIE = "tdr_access_token";
export const REFRESH_TOKEN_COOKIE = "tdr_refresh_token";

export async function signAccessToken(user: CurrentUser) {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export async function signRefreshToken(sessionId: string, userId: string) {
  return new SignJWT({ sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, accessSecret);
  return payload.user as CurrentUser;
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, refreshSecret);
  return {
    userId: payload.sub as string,
    sessionId: payload.sessionId as string,
  };
}
