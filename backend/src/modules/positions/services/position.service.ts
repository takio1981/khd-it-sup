import { randomUUID } from 'node:crypto';
import { PositionRepository } from '@modules/positions/repositories/position.repository';
import type { CreatePositionDto, UpdatePositionDto } from '@modules/positions/dto/position.dto';
import { ConflictError, NotFoundError } from '@common/errors';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

export class PositionService {
  private readonly repo = new PositionRepository();

  async list() {
    return this.repo.findAll();
  }

  async getById(id: string) {
    const position = await this.repo.findById(id);
    if (!position) throw new NotFoundError('ไม่พบตำแหน่งงาน');
    return position;
  }

  async create(dto: CreatePositionDto, ctx: IRequestContext) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) throw new ConflictError('รหัสตำแหน่งงานนี้มีอยู่แล้ว');

    const position = await this.repo.create({ id: randomUUID(), ...dto });
    await auditLogService.record(
      { action: 'CREATE', module: 'user', entityType: 'Position', entityId: position.id, description: `สร้างตำแหน่งงาน ${position.nameTh}` },
      ctx,
    );
    return position;
  }

  async update(id: string, dto: UpdatePositionDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบตำแหน่งงาน');

    const position = await this.repo.update(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'user', entityType: 'Position', entityId: id, description: `แก้ไขตำแหน่งงาน ${position.nameTh}` },
      ctx,
    );
    return position;
  }

  async remove(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบตำแหน่งงาน');

    const userCount = await this.repo.countUsers(id);
    if (userCount > 0) {
      throw new ConflictError('ไม่สามารถลบตำแหน่งงานที่ยังมีผู้ใช้งานอยู่ได้ กรุณาย้ายข้อมูลก่อน');
    }

    await this.repo.softDeactivate(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'user', entityType: 'Position', entityId: id, description: `ปิดใช้งานตำแหน่งงาน ${existing.nameTh}` },
      ctx,
    );
  }
}
