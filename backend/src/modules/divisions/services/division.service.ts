import { randomUUID } from 'node:crypto';
import { DivisionRepository } from '@modules/divisions/repositories/division.repository';
import type { CreateDivisionDto, UpdateDivisionDto } from '@modules/divisions/dto/division.dto';
import { ConflictError, NotFoundError } from '@common/errors';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

export class DivisionService {
  private readonly repo = new DivisionRepository();

  async list() {
    return this.repo.findAll();
  }

  async getById(id: string) {
    const division = await this.repo.findById(id);
    if (!division) throw new NotFoundError('ไม่พบแผนก');
    return division;
  }

  async create(dto: CreateDivisionDto, ctx: IRequestContext) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) throw new ConflictError('รหัสแผนกนี้มีอยู่แล้ว');

    const division = await this.repo.create({ id: randomUUID(), ...dto });
    await auditLogService.record(
      { action: 'CREATE', module: 'department', entityType: 'Division', entityId: division.id, description: `สร้างแผนก ${division.nameTh}` },
      ctx,
    );
    return division;
  }

  async update(id: string, dto: UpdateDivisionDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบแผนก');

    const division = await this.repo.update(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'department', entityType: 'Division', entityId: id, description: `แก้ไขแผนก ${division.nameTh}` },
      ctx,
    );
    return division;
  }

  async remove(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบแผนก');

    await this.repo.softDeactivate(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'department', entityType: 'Division', entityId: id, description: `ปิดใช้งานแผนก ${existing.nameTh}` },
      ctx,
    );
  }
}
