import { VendorRepository, type IVendorListFilter } from '@modules/vendors/repositories/vendor.repository';
import type { CreateVendorDto, ListVendorsQueryDto, UpdateVendorDto } from '@modules/vendors/dto/vendor.dto';
import { ConflictError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

const EXPORT_MAX_ROWS = 5000;

export class VendorService {
  private readonly repo = new VendorRepository();

  async list(query: ListVendorsQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findMany({ keyword: query.keyword, activeOnly: query.activeOnly }, pagination);
    return buildPaginatedResult(items, total, pagination);
  }

  async listForExport(filter: IVendorListFilter) {
    const { items } = await this.repo.findMany(filter, { page: 1, limit: EXPORT_MAX_ROWS, skip: 0, take: EXPORT_MAX_ROWS });
    return items;
  }

  async getById(id: string) {
    const vendor = await this.repo.findById(id);
    if (!vendor) throw new NotFoundError('ไม่พบผู้ขาย/ผู้รับซ่อมภายนอก');
    return vendor;
  }

  async create(dto: CreateVendorDto, ctx: IRequestContext) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) throw new ConflictError('รหัสผู้ขาย/ผู้รับซ่อมนี้มีอยู่แล้ว');

    const vendor = await this.repo.create(dto);
    await auditLogService.record(
      { action: 'CREATE', module: 'vendor', entityType: 'Vendor', entityId: vendor.id, description: `เพิ่มผู้ขาย/ผู้รับซ่อม ${vendor.code} - ${vendor.name}` },
      ctx,
    );
    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto, ctx: IRequestContext) {
    await this.getById(id);
    const vendor = await this.repo.update(id, dto);
    await auditLogService.record(
      { action: 'UPDATE', module: 'vendor', entityType: 'Vendor', entityId: id, description: `แก้ไขผู้ขาย/ผู้รับซ่อม ${vendor.code}` },
      ctx,
    );
    return vendor;
  }
}

export const vendorService = new VendorService();
