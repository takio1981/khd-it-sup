import { randomUUID } from 'node:crypto';
import { DepartmentRepository } from '@modules/departments/repositories/department.repository';
import type { CreateDepartmentDto, UpdateDepartmentDto } from '@modules/departments/dto/department.dto';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

export class DepartmentService {
  private readonly repo = new DepartmentRepository();

  async list() {
    return this.repo.findAll();
  }

  async getById(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundError('ไม่พบหน่วยงาน');
    return dept;
  }

  async create(dto: CreateDepartmentDto, ctx: IRequestContext) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) throw new ConflictError('รหัสหน่วยงานนี้มีอยู่แล้ว');

    const dept = await this.repo.create({ id: randomUUID(), ...dto });
    await auditLogService.record(
      { action: 'CREATE', module: 'department', entityType: 'Department', entityId: dept.id, description: `สร้างหน่วยงาน ${dept.nameTh}` },
      ctx,
    );
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบหน่วยงาน');
    if (dto.parentId === id) throw new BadRequestError('หน่วยงานไม่สามารถเป็น parent ของตัวเองได้');

    const dept = await this.repo.update(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'department', entityType: 'Department', entityId: id, beforeData: existing, afterData: dept },
      ctx,
    );
    return dept;
  }

  async remove(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('ไม่พบหน่วยงาน');

    const [childCount, userCount, divisionCount] = await Promise.all([
      this.repo.countChildren(id),
      this.repo.countUsers(id),
      this.repo.countDivisions(id),
    ]);
    if (childCount > 0 || userCount > 0 || divisionCount > 0) {
      throw new ConflictError('ไม่สามารถลบหน่วยงานที่ยังมีหน่วยงานย่อย ผู้ใช้งาน หรือแผนกอยู่ได้ กรุณาย้ายข้อมูลก่อน');
    }

    await this.repo.softDeactivate(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'department', entityType: 'Department', entityId: id, description: `ปิดใช้งานหน่วยงาน ${existing.nameTh}` },
      ctx,
    );
  }
}
