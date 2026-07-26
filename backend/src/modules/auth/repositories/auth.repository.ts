import { prisma } from '@infrastructure/database/prisma';
import type { Prisma, User } from '@prisma/client';

export type UserWithRole = User & {
  role: { code: string; rolePermissions: { permission: { code: string } }[] };
};

export class AuthRepository {
  async findUserByUsernameOrEmail(usernameOrEmail: string): Promise<UserWithRole | null> {
    return prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
        },
      },
    }) as Promise<UserWithRole | null>;
  }

  async findUserById(id: string): Promise<UserWithRole | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
        },
      },
    }) as Promise<UserWithRole | null>;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }

  async updatePassword(userId: string, passwordHash: string, mustChangePassword = false): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword },
    });
  }

  async createRefreshToken(data: Prisma.RefreshTokenUncheckedCreateInput) {
    return prisma.refreshToken.create({ data });
  }

  async findRefreshTokenById(id: string) {
    return prisma.refreshToken.findUnique({ where: { id } });
  }

  async updateRefreshTokenHash(id: string, tokenHash: string): Promise<void> {
    await prisma.refreshToken.update({ where: { id }, data: { tokenHash } });
  }

  async revokeRefreshToken(id: string, replacedById?: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
