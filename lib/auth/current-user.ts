import { verifyAccessToken } from "@/lib/auth/jwt";
import { getAccessToken } from "@/lib/auth/request-auth";
import { UnauthorizedError } from "@/lib/errors";

export async function getCurrentUser() {
  const token = await getAccessToken();

  if (!token) {
    throw new UnauthorizedError();
  }

  try {
    return await verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
