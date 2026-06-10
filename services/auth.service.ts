import { addDays } from "date-fns";
import { AuditAction } from "@/generated/prisma/client";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { auditRepository } from "@/repositories/audit.repository";
import { toSafeUser, userRepository, type UserWithAccess } from "@/repositories/user.repository";
import type { CurrentUser } from "@/types/domain";

function toCurrentUser(user: UserWithAccess): CurrentUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    roles: user.roles.map(({ role }) => role.name),
    areaIds: user.userAreas.map(({ areaId }) => areaId),
  };
}

async function createRefreshSession(userId: string, requestInfo: RequestInfo) {
  const session = await prisma.session.create({
    data: {
      userId,
      refreshHash: "pending",
      expiresAt: addDays(new Date(), 30),
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
    },
  });

  const refreshToken = await signRefreshToken(session.id, userId);
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshHash: await hashPassword(refreshToken) },
  });

  return refreshToken;
}

type RequestInfo = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export const authService = {
  async login(input: {
    organizationSlug: string;
    email: string;
    password: string;
    requestInfo: RequestInfo;
  }) {
    const organization = await prisma.organization.findUnique({
      where: { slug: input.organizationSlug },
    });

    if (!organization || !organization.isActive) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const user = await userRepository.findByEmail(organization.id, input.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const currentUser = toCurrentUser(user);
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(currentUser),
      createRefreshSession(user.id, input.requestInfo),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      auditRepository.record({
        organizationId: user.organizationId,
        actorId: user.id,
        action: AuditAction.LOGIN,
        entityType: "User",
        entityId: user.id,
        ipAddress: input.requestInfo.ipAddress,
        userAgent: input.requestInfo.userAgent,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: toSafeUser(user),
    };
  },

  async refresh(refreshToken: string, requestInfo: RequestInfo) {
    const token = await verifyRefreshToken(refreshToken);
    const session = await prisma.session.findUnique({
      where: { id: token.sessionId },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            userAreas: { include: { area: true } },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.userId !== token.userId ||
      !(await verifyPassword(refreshToken, session.refreshHash))
    ) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const currentUser = toCurrentUser(session.user);
    const [accessToken, nextRefreshToken] = await Promise.all([
      signAccessToken(currentUser),
      createRefreshSession(session.userId, requestInfo),
    ]);

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: toSafeUser(session.user),
    };
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    try {
      const token = await verifyRefreshToken(refreshToken);
      await prisma.session.updateMany({
        where: { id: token.sessionId, userId: token.userId },
        data: { revokedAt: new Date() },
      });
    } catch {
      throw new AppError("Invalid session", 400);
    }
  },
};
