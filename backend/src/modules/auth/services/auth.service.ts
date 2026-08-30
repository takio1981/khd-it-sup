import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import ms from 'ms';
import { env } from '@config/env';
import { AuthRepository, type UserWithRole } from '@modules/auth/repositories/auth.repository';
import type { PinLoginDto, PinSetupDto, UpdateNotificationChannelsDto } from '@modules/auth/dto/auth.dto';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '@common/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@common/utils/jwt.util';
import { deriveDeviceLabel } from '@common/utils/deviceLabel.util';
import type { IAuthUser } from '@common/interfaces';
import type { Permission } from '@common/constants/permissions.const';
import type { RoleCode } from '@common/constants/roles.const';
import { logger } from '@infrastructure/logger/logger';
import { deleteUploadedFileByUrl } from '@infrastructure/storage/multer.config';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { notificationService } from '@modules/notifications/services/notification.service';

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

export interface IPinSetupResult {
  deviceSecret: string;
  deviceLabel: string | null;
  expiresAt: Date;
}

export interface IPinLoginResult extends ILoginResult {
  deviceSecret: string;
  deviceExpiresAt: Date;
}

export interface IPinDeviceStatus {
  available: boolean;
  /** เคยตั้งค่า PIN บนอุปกรณ์นี้มาก่อน (มีแถวอยู่ แม้ตอนนี้จะถูกยกเลิก/หมดอายุ) — reactivate ได้โดยไม่ต้องตั้ง PIN ใหม่ */
  hasHistory: boolean;
  username?: string;
  fullName?: string;
  gender?: UserWithRole['gender'];
}

export interface IPinDeviceSummary {
  id: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  isCurrentDevice: boolean;
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
    avatarUrl: user.avatarUrl,
    gender: user.gender,
    isUnitHead: user.isUnitHead,
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

/** อายุลิงก์รีเซ็ตรหัสผ่านแบบ self-service (นาที) */
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

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

    return this.issueSession(user, ctx, 'PASSWORD');
  }

  /** ออก access/refresh token คู่ใหม่ ใช้ร่วมกันทั้ง login ด้วยรหัสผ่านและ login ด้วย PIN เพื่อให้ session ที่ได้เหมือนกันทุกจุด */
  private async issueSession(user: UserWithRole, ctx: ILoginContext, method: 'PASSWORD' | 'PIN'): Promise<ILoginResult> {
    await this.repo.updateLastLogin(user.id);

    const authUser = toAuthUser(user);
    const accessToken = signAccessToken(authUser);
    const { refreshToken, expiresAt } = await this.issueRefreshToken(user.id, ctx);

    logger.info(`[auth] login success (${method}): ${user.username} from ${ctx.ipAddress}`);
    await auditLogService.record(
      {
        action: 'LOGIN',
        module: 'auth',
        entityType: 'User',
        entityId: user.id,
        description: method === 'PIN' ? `${user.username} เข้าสู่ระบบด้วย PIN` : `${user.username} เข้าสู่ระบบ`,
      },
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
    await this.repo.revokeAllUserPinCredentials(userId);
    logger.info(`[auth] password changed for user ${userId}`);
  }

  async getNotificationChannels(userId: string): Promise<{ telegramChatId: string | null; lineUserId: string | null }> {
    const result = await this.repo.getNotificationChannels(userId);
    if (!result) throw new UnauthorizedError();
    return result;
  }

  /** ให้ผู้ใช้แต่ละคนผูกช่องทาง Telegram/LINE ส่วนตัวของตนเอง เพื่อรับแจ้งเตือนสถานะงานซ่อม/ยืม-คืนโดยตรง (คู่ขนานกับกลุ่มไอทีกลาง) */
  async updateNotificationChannels(
    userId: string,
    data: UpdateNotificationChannelsDto,
  ): Promise<{ telegramChatId: string | null; lineUserId: string | null }> {
    return this.repo.updateNotificationChannels(userId, data);
  }

  /** ให้ผู้ใช้แต่ละคนอัปโหลดรูปโปรไฟล์ของตนเองผ่านเมนูโปรไฟล์ */
  async setMyAvatar(userId: string, file: Express.Multer.File): Promise<IAuthUser> {
    const existing = await this.repo.findUserById(userId);
    if (!existing) throw new UnauthorizedError();

    if (existing.avatarUrl) deleteUploadedFileByUrl(existing.avatarUrl, 'avatars');

    const avatarUrl = `${env.API_PREFIX}/files/avatars/${file.filename}`;
    const updated = await this.repo.updateAvatar(userId, avatarUrl);
    return toAuthUser(updated);
  }

  async removeMyAvatar(userId: string): Promise<IAuthUser> {
    const existing = await this.repo.findUserById(userId);
    if (!existing) throw new UnauthorizedError();

    if (existing.avatarUrl) deleteUploadedFileByUrl(existing.avatarUrl, 'avatars');

    const updated = await this.repo.updateAvatar(userId, null);
    return toAuthUser(updated);
  }

  /** ให้ผู้ใช้เลือกเพศของตนเอง (ใช้เลือกภาพ avatar เริ่มต้นเมื่อยังไม่อัปโหลดรูปโปรไฟล์) */
  async updateMyGender(userId: string, gender: 'MALE' | 'FEMALE'): Promise<IAuthUser> {
    const updated = await this.repo.updateGender(userId, gender);
    return toAuthUser(updated);
  }

  /**
   * ขอลิงก์ตั้งรหัสผ่านใหม่แบบ self-service — ตอบสำเร็จเสมอไม่ว่าจะพบบัญชีหรือไม่ (ป้องกันการเดาว่า
   * username/email ไหนมีอยู่ในระบบจริง) ส่งอีเมลจริงเฉพาะกรณีพบบัญชีที่ active และมีอีเมลเท่านั้น
   */
  async forgotPassword(usernameOrEmail: string): Promise<void> {
    const user = await this.repo.findUserByUsernameOrEmail(usernameOrEmail);
    if (!user || !user.isActive) return;

    await this.repo.invalidateUserPasswordResetTokens(user.id);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await this.repo.createPasswordResetToken({ id: randomUUID(), userId: user.id, tokenHash: hashToken(token), expiresAt });

    try {
      await notificationService.sendForgotPasswordEmail(
        { fullName: user.fullName, username: user.username, email: user.email },
        token,
        PASSWORD_RESET_TOKEN_TTL_MINUTES,
      );
    } catch (err) {
      logger.error(`[auth] ส่งอีเมลลืมรหัสผ่านไม่สำเร็จ (${user.username}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** ตั้งรหัสผ่านใหม่ด้วย token จากอีเมล — เพิกถอน refresh token ทุก session เดิมเสมอเพื่อความปลอดภัย */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await this.repo.findValidPasswordResetToken(hashToken(token));
    if (!stored) {
      throw new BadRequestError('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง');
    }

    const newHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
    await this.repo.updatePassword(stored.userId, newHash, false);
    await this.repo.markPasswordResetTokenUsed(stored.id);
    await this.repo.revokeAllUserRefreshTokens(stored.userId);
    await this.repo.revokeAllUserPinCredentials(stored.userId);
    logger.info(`[auth] password reset via self-service link for user ${stored.userId}`);
  }

  /**
   * ตั้งค่า/ตั้งใหม่ PIN สำหรับอุปกรณ์นี้ — ต้องยืนยันรหัสผ่านปัจจุบันซ้ำก่อนเสมอ (เหมือน changePassword)
   * เพราะเป็นการสร้าง credential อายุยาว (PIN_DEVICE_TTL) ให้อุปกรณ์นี้ใช้เข้าระบบแทนรหัสผ่านได้
   *
   * ถ้าอุปกรณ์นี้มี PIN cookie ของ user คนเดียวกันอยู่แล้ว (ลืม PIN แล้วมา login รหัสผ่านตั้งใหม่) จะอัปเดตแถวเดิม
   * แทนการสร้างซ้ำ — ถ้าไม่มี หรือเป็นของ user คนอื่น (เครื่อง kiosk ที่เคยมีคนอื่นตั้ง PIN ไว้ก่อน) จะสร้างแถว+secret ใหม่
   */
  async setupPin(
    userId: string,
    dto: PinSetupDto,
    ctx: ILoginContext,
    userAgent: string,
    existingDeviceSecret?: string,
  ): Promise<IPinSetupResult> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new BadRequestError('รหัสผ่านไม่ถูกต้อง', 'INVALID_CURRENT_PASSWORD');
    }

    const pinHash = await bcrypt.hash(dto.pin, env.BCRYPT_SALT_ROUNDS);
    const deviceLabel = deriveDeviceLabel(userAgent);
    const expiresAt = this.pinDeviceExpiresAt();

    if (existingDeviceSecret) {
      const existing = await this.repo.findPinCredentialByDeviceSecretHash(hashToken(existingDeviceSecret));
      if (existing && existing.userId === userId) {
        await this.repo.resetPinCredentialForReSetup(existing.id, { pinHash, expiresAt, deviceLabel });
        logger.info(`[auth] PIN re-setup for user ${userId} on existing device`);
        return { deviceSecret: existingDeviceSecret, deviceLabel, expiresAt };
      }
    }

    const deviceSecret = crypto.randomBytes(32).toString('hex');
    await this.repo.createPinCredential({
      id: randomUUID(),
      userId,
      deviceSecretHash: hashToken(deviceSecret),
      pinHash,
      deviceLabel,
      expiresAt,
      createdByIp: ctx.ipAddress,
      userAgent,
    });
    logger.info(`[auth] PIN setup for user ${userId} on new device`);
    return { deviceSecret, deviceLabel, expiresAt };
  }

  /**
   * ตรวจสอบว่าอุปกรณ์นี้ (deviceSecret cookie) มี PIN ที่ยังใช้งานได้อยู่หรือไม่ — ไม่ต้อง login และไม่แตะ
   * failedAttempts/lockedUntil เลย (แค่เช็คว่าควรเสนอหน้ากรอก PIN หรือไม่ ไม่ใช่การพยายาม login จริง)
   *
   * นี่คือแหล่งความจริงที่ frontend ควรอิงในการตัดสินใจว่าจะแสดงหน้า PIN หรือฟอร์มรหัสผ่าน — ไม่ใช่ localStorage
   * marker ฝั่ง client เพียงอย่างเดียว เพราะ marker อาจไม่ตรงกับความจริงได้หลายทาง เช่น cookie ถูกล้างแต่
   * localStorage ยังอยู่ (หรือกลับกัน — บาง in-app browser ล้าง localStorage ไวกว่า cookie), PIN ถูกยกเลิกจาก
   * อุปกรณ์อื่น (revokePinDevice/disablePin/changePassword) โดยที่อุปกรณ์นี้ยังไม่เคยลองใช้ PIN ซ้ำเพื่อ
   * self-heal marker ของตัวเอง, หรือ PIN หมดอายุไปเฉยๆ ตามเวลา
   */
  async getPinDeviceStatus(deviceSecret: string | undefined): Promise<IPinDeviceStatus> {
    if (!deviceSecret) {
      return { available: false, hasHistory: false };
    }

    const row = await this.repo.findPinCredentialByDeviceSecretHash(hashToken(deviceSecret));
    if (!row) {
      return { available: false, hasHistory: false };
    }

    const user = await this.repo.findUserById(row.userId);
    if (!user || !user.isActive) {
      return { available: false, hasHistory: false };
    }

    const isActive = !row.revokedAt && row.expiresAt >= new Date();
    return { available: isActive, hasHistory: true, username: user.username, fullName: user.fullName, gender: user.gender };
  }

  /**
   * เปิดใช้งาน PIN ของอุปกรณ์นี้กลับมาอีกครั้งโดยไม่ต้องตั้ง PIN ใหม่ — ใช้กับสวิตช์เปิด/ปิด PIN เมื่อเครื่องนี้
   * เคยตั้งค่า PIN ไว้ก่อนแล้ว (revoked/expired) เพียงแค่ยกเลิกการ revoke + ต่ออายุ PIN hash เดิมยังใช้ได้ตามปกติ
   * ไม่มีความเสี่ยงเพิ่มขึ้น เพราะต้องผ่านการยืนยันตัวตนด้วย bearer token ที่ authenticate อยู่แล้วก่อนเรียก endpoint นี้
   */
  async reactivateCurrentPinDevice(userId: string, deviceSecret: string | undefined): Promise<void> {
    if (!deviceSecret) {
      throw new NotFoundError('ไม่พบประวัติการตั้งค่า PIN บนเครื่องนี้');
    }

    const row = await this.repo.findPinCredentialByDeviceSecretHash(hashToken(deviceSecret));
    if (!row || row.userId !== userId) {
      throw new NotFoundError('ไม่พบประวัติการตั้งค่า PIN บนเครื่องนี้');
    }

    await this.repo.reactivatePinCredential(row.id, this.pinDeviceExpiresAt());
    logger.info(`[auth] PIN device reactivated (self-service, current device): ${row.id} (user ${userId})`);
  }

  /**
   * เข้าสู่ระบบด้วย PIN — ยืนยันตัวตนด้วย "อุปกรณ์ที่เคยเชื่อถือแล้ว" (deviceSecret จาก httpOnly cookie)
   * ร่วมกับ PIN 6 หลัก แทนที่จะเป็น PIN เปล่าๆ ที่ใช้ได้จากอุปกรณ์ไหนก็ได้
   */
  async loginWithPin(deviceSecret: string | undefined, dto: PinLoginDto, ctx: ILoginContext): Promise<IPinLoginResult> {
    if (!deviceSecret) {
      throw new UnauthorizedError('ไม่พบอุปกรณ์ที่ตั้งค่า PIN ไว้ กรุณาเข้าสู่ระบบด้วยรหัสผ่าน', 'PIN_DEVICE_MISSING');
    }

    const row = await this.repo.findPinCredentialByDeviceSecretHash(hashToken(deviceSecret));
    if (!row) {
      throw new UnauthorizedError('อุปกรณ์นี้ยังไม่ได้ตั้งค่า PIN กรุณาเข้าสู่ระบบด้วยรหัสผ่าน', 'PIN_DEVICE_UNKNOWN');
    }
    if (row.revokedAt) {
      throw new UnauthorizedError('PIN ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่าน', 'PIN_REVOKED');
    }
    if (row.expiresAt < new Date()) {
      throw new UnauthorizedError('PIN หมดอายุแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่าน', 'PIN_EXPIRED');
    }
    if (row.lockedUntil && row.lockedUntil > new Date()) {
      throw new UnauthorizedError('ลองใส่ PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลังหรือเข้าสู่ระบบด้วยรหัสผ่าน', 'PIN_LOCKED');
    }

    const user = await this.repo.findUserById(row.userId);
    if (!user || !user.isActive) {
      throw new ForbiddenError('บัญชีผู้ใช้นี้ไม่สามารถใช้งานได้');
    }

    const pinMatches = await bcrypt.compare(dto.pin, row.pinHash);
    if (!pinMatches) {
      const failedAttempts = row.failedAttempts + 1;

      if (failedAttempts >= env.PIN_REVOKE_AFTER_ATTEMPTS) {
        await this.repo.updatePinCredentialOnFailure(row.id, { failedAttempts, lockedUntil: null, revokedAt: new Date() });
        throw new UnauthorizedError('ใส่ PIN ผิดหลายครั้งเกินไป PIN ถูกยกเลิก กรุณาเข้าสู่ระบบด้วยรหัสผ่าน', 'PIN_REVOKED');
      }
      if (failedAttempts >= env.PIN_MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + env.PIN_LOCKOUT_MINUTES * 60 * 1000);
        await this.repo.updatePinCredentialOnFailure(row.id, { failedAttempts, lockedUntil, revokedAt: null });
        throw new UnauthorizedError('ลองใส่ PIN ผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลังหรือเข้าสู่ระบบด้วยรหัสผ่าน', 'PIN_LOCKED');
      }
      await this.repo.updatePinCredentialOnFailure(row.id, { failedAttempts, lockedUntil: null, revokedAt: null });
      throw new UnauthorizedError('PIN ไม่ถูกต้อง', 'PIN_INVALID');
    }

    const deviceExpiresAt = this.pinDeviceExpiresAt();
    await this.repo.updatePinCredentialOnSuccess(row.id, deviceExpiresAt);

    const session = await this.issueSession(user, ctx, 'PIN');
    return { ...session, deviceSecret, deviceExpiresAt };
  }

  async listPinDevices(userId: string, currentDeviceSecret?: string): Promise<IPinDeviceSummary[]> {
    const rows = await this.repo.findActivePinCredentialsByUser(userId);
    const currentHash = currentDeviceSecret ? hashToken(currentDeviceSecret) : null;

    return rows.map((row) => ({
      id: row.id,
      deviceLabel: row.deviceLabel,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
      isCurrentDevice: currentHash !== null && row.deviceSecretHash === currentHash,
    }));
  }

  /** คืน wasCurrentDevice เพื่อให้ controller รู้ว่าต้องล้าง PIN cookie ของ request นี้ด้วยหรือไม่ */
  async revokePinDevice(userId: string, id: string, currentDeviceSecret?: string): Promise<{ wasCurrentDevice: boolean }> {
    const row = await this.repo.findPinCredentialById(id);
    if (!row || row.userId !== userId) {
      throw new NotFoundError('ไม่พบอุปกรณ์ที่ต้องการยกเลิก');
    }
    await this.repo.revokePinCredential(id);
    logger.info(`[auth] PIN device revoked: ${id} (user ${userId})`);

    const wasCurrentDevice = !!currentDeviceSecret && row.deviceSecretHash === hashToken(currentDeviceSecret);
    return { wasCurrentDevice };
  }

  async disablePin(userId: string): Promise<void> {
    await this.repo.revokeAllUserPinCredentials(userId);
    logger.info(`[auth] all PIN devices disabled for user ${userId}`);
  }

  /**
   * ปิดใช้งาน PIN เฉพาะ "อุปกรณ์นี้" (จาก deviceSecret cookie ของ request เอง) — ใช้กับสวิตช์เปิด/ปิด PIN
   * ที่หน้าตั้งค่า PIN ไม่ต้องรู้ device id ล่วงหน้าเหมือน revokePinDevice เพราะ device ปัจจุบันระบุได้จาก
   * cookie อยู่แล้ว เป็น idempotent — ถ้าไม่มี cookie/หา row ไม่เจอ/ไม่ใช่ของ user นี้ ก็แค่ไม่ทำอะไร (ไม่ throw)
   */
  async revokeCurrentPinDevice(userId: string, deviceSecret: string | undefined): Promise<void> {
    if (!deviceSecret) return;

    const row = await this.repo.findPinCredentialByDeviceSecretHash(hashToken(deviceSecret));
    if (!row || row.userId !== userId || row.revokedAt) return;

    await this.repo.revokePinCredential(row.id);
    logger.info(`[auth] PIN device revoked (self-service, current device): ${row.id} (user ${userId})`);
  }

  private pinDeviceExpiresAt(): Date {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ms() branded StringValue type ไม่รองรับ z.string() runtime value โดยตรง ค่าจริงถูก validate รูปแบบแล้วใน env.ts
    return new Date(Date.now() + (ms as (v: any) => number)(env.PIN_DEVICE_TTL));
  }

  toAuthUser = toAuthUser;
}
