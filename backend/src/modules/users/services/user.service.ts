import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { UserRepository, type IUserListFilter } from '@modules/users/repositories/user.repository';
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from '@modules/users/dto/user.dto';
import { ConflictError, ForbiddenError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { env } from '@config/env';
import { deleteUploadedFileByUrl } from '@infrastructure/storage/multer.config';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { notificationService } from '@modules/notifications/services/notification.service';
import type { IRequestContext } from '@common/interfaces';

const EXPORT_MAX_ROWS = 5000;

/** จำนวนงานที่ยังไม่ปิดสูงสุดที่ยังถือว่า "ว่าง" — เกินกว่านี้ถือว่า "ไม่ว่าง" (เกณฑ์เริ่มต้นสำหรับทีมขนาดเล็ก ปรับได้ตามจริง) */
const AVAILABILITY_THRESHOLD = 2;

function generateTemporaryPassword(): string {
  // 12 ตัวอักษร base64url อ่านง่ายพอสมควร ปลอดภัยพอสำหรับรหัสผ่านชั่วคราวที่บังคับเปลี่ยนทันที
  return crypto.randomBytes(9).toString('base64url');
}

export class UserService {
  private readonly repo = new UserRepository();

  async listRoles() {
    return this.repo.findAllRoles();
  }

  async getStats() {
    return this.repo.getStats();
  }

  async listTechnicians() {
    return this.repo.findTechnicians();
  }

  /** ภาระงาน + สถานะว่าง/ไม่ว่างของช่าง/เจ้าหน้าที่ไอทีทุกคน — ใช้ทั้งตอนมอบหมายงาน (เลือกคนว่างก่อน) และหน้ารายงานเปรียบเทียบ */
  async listTechnicianWorkload() {
    const items = await this.repo.findTechniciansWithWorkload();
    return items
      .map((t) => ({
        ...t,
        availability: (t.activeTicketCount <= AVAILABILITY_THRESHOLD ? 'AVAILABLE' : 'BUSY') as 'AVAILABLE' | 'BUSY',
      }))
      .sort((a, b) => a.activeTicketCount - b.activeTicketCount);
  }

  async list(query: ListUsersQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findMany(
      { roleId: query.roleId, departmentId: query.departmentId, keyword: query.keyword },
      pagination,
    );
    const sanitized = items.map(({ passwordHash: _ph, ...rest }) => rest);
    return buildPaginatedResult(sanitized, total, pagination);
  }

  async listForExport(filter: IUserListFilter) {
    const { items } = await this.repo.findMany(filter, { page: 1, limit: EXPORT_MAX_ROWS, skip: 0, take: EXPORT_MAX_ROWS });
    return items.map(({ passwordHash: _ph, ...rest }) => rest);
  }

  async getById(id: string) {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError('ไม่พบผู้ใช้');
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }

  async create(dto: CreateUserDto, ctx: IRequestContext) {
    const existing = await this.repo.findByUsernameOrEmail(dto.username, dto.email);
    if (existing) {
      throw new ConflictError('ชื่อผู้ใช้หรืออีเมลนี้มีอยู่ในระบบแล้ว');
    }

    const passwordHash = await bcrypt.hash(dto.password, env.BCRYPT_SALT_ROUNDS);
    const user = await this.repo.create({
      id: randomUUID(),
      username: dto.username,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      gender: dto.gender,
      employeeCode: dto.employeeCode,
      roleId: dto.roleId,
      departmentId: dto.departmentId,
      positionId: dto.positionId,
      isUnitHead: dto.isUnitHead ?? false,
      mustChangePassword: true,
      createdBy: ctx.user.id,
    });

    await auditLogService.record(
      { action: 'CREATE', module: 'user', entityType: 'User', entityId: user.id, description: `สร้างผู้ใช้ ${user.username}` },
      ctx,
    );

    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }

  async update(id: string, dto: UpdateUserDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบผู้ใช้');

    const user = await this.repo.update(id, { ...dto, updatedBy: ctx.user.id });

    await auditLogService.record(
      { action: 'UPDATE', module: 'user', entityType: 'User', entityId: id, beforeData: sanitizeForAudit(existing), afterData: sanitizeForAudit(user) },
      ctx,
    );

    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }

  async remove(id: string, ctx: IRequestContext) {
    if (id === ctx.user.id) {
      throw new ForbiddenError('ไม่สามารถลบบัญชีของตนเองได้');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบผู้ใช้');

    await this.repo.softDelete(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'user', entityType: 'User', entityId: id, description: `ลบผู้ใช้ ${existing.username}` },
      ctx,
    );
  }

  async setAvatar(id: string, file: Express.Multer.File, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบผู้ใช้');

    if (existing.avatarUrl) deleteUploadedFileByUrl(existing.avatarUrl, 'avatars');

    const avatarUrl = `${env.API_PREFIX}/files/avatars/${file.filename}`;
    const user = await this.repo.update(id, { avatarUrl, updatedBy: ctx.user.id });

    await auditLogService.record(
      { action: 'UPDATE', module: 'user', entityType: 'User', entityId: id, description: `อัปเดตรูปโปรไฟล์ผู้ใช้ ${existing.username}` },
      ctx,
    );

    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }

  async removeAvatar(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบผู้ใช้');

    if (existing.avatarUrl) deleteUploadedFileByUrl(existing.avatarUrl, 'avatars');

    const user = await this.repo.update(id, { avatarUrl: null, updatedBy: ctx.user.id });

    await auditLogService.record(
      { action: 'UPDATE', module: 'user', entityType: 'User', entityId: id, description: `ลบรูปโปรไฟล์ผู้ใช้ ${existing.username}` },
      ctx,
    );

    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }

  async resetPassword(id: string, ctx: IRequestContext): Promise<{ message: string }> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบผู้ใช้');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, env.BCRYPT_SALT_ROUNDS);
    await this.repo.update(id, { passwordHash, mustChangePassword: true, updatedBy: ctx.user.id });

    await notificationService.sendPasswordResetEmail(
      { fullName: existing.fullName, username: existing.username, email: existing.email },
      temporaryPassword,
    );

    await auditLogService.record(
      { action: 'UPDATE', module: 'user', entityType: 'User', entityId: id, description: `รีเซ็ตรหัสผ่านผู้ใช้ ${existing.username}` },
      ctx,
    );

    return { message: `ส่งรหัสผ่านชั่วคราวไปยังอีเมล ${existing.email} เรียบร้อยแล้ว` };
  }
}

function sanitizeForAudit(user: { passwordHash?: string; [key: string]: unknown }) {
  const { passwordHash: _ph, ...rest } = user;
  return rest;
}
