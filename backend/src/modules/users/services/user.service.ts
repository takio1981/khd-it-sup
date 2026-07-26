import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserRepository } from '@modules/users/repositories/user.repository';
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from '@modules/users/dto/user.dto';
import { ConflictError, ForbiddenError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { env } from '@config/env';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import { notificationService } from '@modules/notifications/services/notification.service';
import type { IRequestContext } from '@common/interfaces';

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

  async list(query: ListUsersQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findMany(
      { roleId: query.roleId, departmentId: query.departmentId, keyword: query.keyword },
      pagination,
    );
    const sanitized = items.map(({ passwordHash: _ph, ...rest }) => rest);
    return buildPaginatedResult(sanitized, total, pagination);
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
      employeeCode: dto.employeeCode,
      roleId: dto.roleId,
      departmentId: dto.departmentId,
      positionId: dto.positionId,
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
