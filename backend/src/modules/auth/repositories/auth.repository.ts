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

  async createPasswordResetToken(data: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await prisma.passwordResetToken.create({ data });
  }

  async findValidPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  async invalidateUserPasswordResetTokens(userId: string): Promise<void> {
    await prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
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

  async updateAvatar(userId: string, avatarUrl: string | null): Promise<UserWithRole> {
    return prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
        },
      },
    }) as Promise<UserWithRole>;
  }

  async updateGender(userId: string, gender: 'MALE' | 'FEMALE'): Promise<UserWithRole> {
    return prisma.user.update({
      where: { id: userId },
      data: { gender },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
        },
      },
    }) as Promise<UserWithRole>;
  }

  async getNotificationChannels(userId: string): Promise<{ telegramChatId: string | null; lineUserId: string | null } | null> {
    return prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true, lineUserId: true } });
  }

  async updateNotificationChannels(
    userId: string,
    data: { telegramChatId?: string | null; lineUserId?: string | null },
  ): Promise<{ telegramChatId: string | null; lineUserId: string | null }> {
    return prisma.user.update({ where: { id: userId }, data, select: { telegramChatId: true, lineUserId: true } });
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

  async createPinCredential(data: Prisma.PinCredentialUncheckedCreateInput) {
    return prisma.pinCredential.create({ data });
  }

  async findPinCredentialByDeviceSecretHash(deviceSecretHash: string) {
    return prisma.pinCredential.findUnique({ where: { deviceSecretHash } });
  }

  async findPinCredentialById(id: string) {
    return prisma.pinCredential.findUnique({ where: { id } });
  }

  async findActivePinCredentialsByUser(userId: string) {
    return prisma.pinCredential.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async resetPinCredentialForReSetup(
    id: string,
    data: { pinHash: string; expiresAt: Date; deviceLabel: string | null },
  ): Promise<void> {
    await prisma.pinCredential.update({
      where: { id },
      data: { ...data, failedAttempts: 0, lockedUntil: null, revokedAt: null },
    });
  }

  async updatePinCredentialOnSuccess(id: string, expiresAt: Date): Promise<void> {
    await prisma.pinCredential.update({
      where: { id },
      data: { failedAttempts: 0, lockedUntil: null, lastUsedAt: new Date(), expiresAt },
    });
  }

  async updatePinCredentialOnFailure(
    id: string,
    data: { failedAttempts: number; lockedUntil: Date | null; revokedAt: Date | null },
  ): Promise<void> {
    await prisma.pinCredential.update({ where: { id }, data });
  }

  async revokePinCredential(id: string): Promise<void> {
    await prisma.pinCredential.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** เปิดใช้งาน PIN เดิมกลับมา (ไม่เปลี่ยน pinHash) — ยกเลิกการ revoke + รีเซ็ตตัวนับล็อก + ต่ออายุ */
  async reactivatePinCredential(id: string, expiresAt: Date): Promise<void> {
    await prisma.pinCredential.update({
      where: { id },
      data: { revokedAt: null, failedAttempts: 0, lockedUntil: null, expiresAt },
    });
  }

  async revokeAllUserPinCredentials(userId: string): Promise<void> {
    await prisma.pinCredential.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
