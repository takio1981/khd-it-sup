import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import ms from 'ms';
import { env } from '@config/env';
import { AuthRepository, type UserWithRole } from '@modules/auth/repositories/auth.repository';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '@common/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@common/utils/jwt.util';
import type { IAuthUser } from '@common/interfaces';
import type { Permission } from '@common/constants/permissions.const';
import type { RoleCode } from '@common/constants/roles.const';
import { logger } from '@infrastructure/logger/logger';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';

export interface ILoginResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: IAuthUser;
}

export interface ILoginContext {
  ipAddress: string;
  userAgent: string;
}

function toAuthUser(user: UserWithRole): IAuthUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role.code as RoleCode,
    permissions: user.role.rolePermissions.map((rp) => rp.permission.code) as Permission[],
    departmentId: user.departmentId,
    mustChangePassword: user.mustChangePassword,
  };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * ช่วงเวลาผ่อนผันการใช้ refresh token ที่เพิ่งถูก rotate ทิ้งไปซ้ำ (มิลลิวินาที)
 * กรณีนี้เกิดได้จริงเมื่อ browser ยกเลิก request กลางคัน (เช่น กด hard-refresh รัวๆ)
 * ทำให้ client ไม่ได้รับ cookie ใหม่ทัน แล้วส่ง token เก่าซ้ำในการโหลดครั้งถัดไป
 * ถ้าอยู่ในช่วงนี้ ถือว่าเป็น race condition ไม่ใช่การขโมย token จึงออก token ใหม่ให้แทนการ revoke ทุก session
 */
const REFRESH_REUSE_GRACE_MS = 30_000;

export class AuthService {
  private readonly repo = new AuthRepository();

  async login(username: string, password: string, ctx: ILoginContext): Promise<ILoginResult> {
    const user = await this.repo.findUserByUsernameOrEmail(username);

    if (!user) {
      throw new UnauthorizedError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    if (!user.isActive) {
      throw new ForbiddenError('บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }

    await this.repo.updateLastLogin(user.id);

    const authUser = toAuthUser(user);
    const accessToken = signAccessToken(authUser);
    const { refreshToken, expiresAt } = await this.issueRefreshToken(user.id, ctx);

    logger.info(`[auth] login success: ${user.username} from ${ctx.ipAddress}`);
    await auditLogService.record(
      { action: 'LOGIN', module: 'auth', entityType: 'User', entityId: user.id, description: `${user.username} เข้าสู่ระบบ` },
      { user: authUser, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
    );

    return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt, user: authUser };
  }

  private async issueRefreshToken(
    userId: string,
    ctx: ILoginContext,
  ): Promise<{ id: string; refreshToken: string; expiresAt: Date }> {
    const id = randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ms() branded StringValue type ไม่รองรับ z.string() runtime value โดยตรง ค่าจริงถูก validate รูปแบบแล้วใน env.ts
    const expiresAt = new Date(Date.now() + (ms as (v: any) => number)(env.JWT_REFRESH_EXPIRES_IN));

    // สร้าง row ก่อนเพื่อได้ id มาเป็น jti แล้วค่อย update tokenHash เมื่อ sign เสร็จ (หลีกเลี่ยง race condition ของ id ซ้ำ)
    await this.repo.createRefreshToken({
      id,
      userId,
      tokenHash: 'pending',
      expiresAt,
      createdByIp: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    const refreshToken = signRefreshToken({ sub: userId, jti: id });
    await this.repo.updateRefreshTokenHash(id, hashToken(refreshToken));
    return { id, refreshToken, expiresAt };
  }

  async refresh(presentedToken: string, ctx: ILoginContext): Promise<ILoginResult> {
    let payload;
    try {
      payload = verifyRefreshToken(presentedToken);
    } catch {
      throw new UnauthorizedError('Refresh Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    const stored = await this.repo.findRefreshTokenById(payload.jti);
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedError('ไม่พบ Refresh Token กรุณาเข้าสู่ระบบใหม่');
    }
    if (stored.tokenHash !== hashToken(presentedToken)) {
      throw new UnauthorizedError('Refresh Token ไม่ถูกต้อง');
    }

    if (stored.revokedAt) {
      const withinGracePeriod = Date.now() - stored.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
      if (withinGracePeriod && stored.replacedById) {
        // มีแนวโน้มเป็น race condition (client ไม่ได้รับ cookie ใหม่ทันก่อน request ถูกยกเลิก) ไม่ใช่การขโมย token
        // -> ออก token คู่ใหม่ให้ user เดิมแทนการ revoke ทุก session
        const user = await this.repo.findUserById(stored.userId);
        if (!user || !user.isActive) {
          throw new ForbiddenError('บัญชีผู้ใช้นี้ไม่สามารถใช้งานได้');
        }
        const { refreshToken: newRefreshToken, expiresAt } = await this.issueRefreshToken(user.id, ctx);
        const authUser = toAuthUser(user);
        return { accessToken: signAccessToken(authUser), refreshToken: newRefreshToken, refreshTokenExpiresAt: expiresAt, user: authUser };
      }

      // token ถูกใช้ซ้ำหลังถูก revoke ไปแล้วเกินช่วงผ่อนผัน (อาจถูกขโมยจริง) — revoke session ทั้งหมดของ user นี้เพื่อความปลอดภัย
      await this.repo.revokeAllUserRefreshTokens(payload.sub);
      throw new UnauthorizedError('ตรวจพบการใช้ Refresh Token ซ้ำ ระบบได้ยกเลิกทุก session เพื่อความปลอดภัย');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh Token หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    const user = await this.repo.findUserById(payload.sub);
    if (!user || !user.isActive) {
      throw new ForbiddenError('บัญชีผู้ใช้นี้ไม่สามารถใช้งานได้');
    }

    // Rotation: revoke token เดิม แล้วออก refresh token ใหม่เสมอ พร้อมบันทึก chain ไว้ (replacedById) เผื่อต้องผ่อนผัน reuse ในอนาคต
    const { id: newId, refreshToken: newRefreshToken, expiresAt } = await this.issueRefreshToken(user.id, ctx);
    await this.repo.revokeRefreshToken(stored.id, newId);

    const authUser = toAuthUser(user);
    const accessToken = signAccessToken(authUser);

    return { accessToken, refreshToken: newRefreshToken, refreshTokenExpiresAt: expiresAt, user: authUser };
  }

  async logout(presentedToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(presentedToken);
      await this.repo.revokeRefreshToken(payload.jti);
    } catch {
      // token ไม่ถูกต้องอยู่แล้ว — logout ถือว่าสำเร็จเสมอ (idempotent)
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestError('รหัสผ่านปัจจุบันไม่ถูกต้อง', 'INVALID_CURRENT_PASSWORD');
    }
    const newHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
    await this.repo.updatePassword(userId, newHash, false);
    await this.repo.revokeAllUserRefreshTokens(userId);
    logger.info(`[auth] password changed for user ${userId}`);
  }

  toAuthUser = toAuthUser;
}
