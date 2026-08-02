import { randomUUID } from 'node:crypto';
import { AssetRepository } from '@modules/assets/repositories/asset.repository';
import type {
  CreateAssetDto,
  CreateCategoryDto,
  ExportAssetsQueryDto,
  ListAssetsQueryDto,
  UpdateAssetDto,
  UpdateCategoryDto,
} from '@modules/assets/dto/asset.dto';
import { runningNumberService } from '@modules/settings/services/runningNumber.service';
import { env } from '@config/env';
import { ConflictError, NotFoundError } from '@common/errors';
import { normalizePagination, buildPaginatedResult } from '@common/utils/pagination';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

const EXPORT_MAX_ROWS = 5000;

export class AssetService {
  private readonly repo = new AssetRepository();

  async list(query: ListAssetsQueryDto) {
    const pagination = normalizePagination(query);
    const { items, total } = await this.repo.findMany(
      { categoryId: query.categoryId, departmentId: query.departmentId, status: query.status, keyword: query.keyword },
      pagination,
    );
    return buildPaginatedResult(items, total, pagination);
  }

  /** ใช้เฉพาะสำหรับ export Excel/CSV — ดึงแบบไม่แบ่งหน้า (จำกัดที่ EXPORT_MAX_ROWS) ใช้ filter เดียวกับ list() ทุกจุด */
  async listForExport(query: ExportAssetsQueryDto) {
    const { items } = await this.repo.findMany(
      { categoryId: query.categoryId, departmentId: query.departmentId, status: query.status, keyword: query.keyword },
      { page: 1, limit: EXPORT_MAX_ROWS, skip: 0, take: EXPORT_MAX_ROWS },
    );
    return items;
  }

  async listCategories() {
    return this.repo.listCategories();
  }

  async createCategory(dto: CreateCategoryDto, ctx: IRequestContext) {
    const existing = await this.repo.findCategoryByCode(dto.code);
    if (existing) throw new ConflictError('รหัสประเภทครุภัณฑ์นี้มีอยู่แล้ว');

    const category = await this.repo.createCategory({
      id: randomUUID(),
      code: dto.code,
      nameTh: dto.nameTh,
      nameEn: dto.nameEn,
      icon: dto.icon,
      requiresSerial: dto.requiresSerial ?? true,
    });

    await auditLogService.record(
      { action: 'CREATE', module: 'asset', entityType: 'AssetCategory', entityId: category.id, description: `สร้างประเภทครุภัณฑ์ ${category.nameTh}` },
      ctx,
    );

    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, ctx: IRequestContext) {
    const category = await this.repo.updateCategory(id, dto);

    await auditLogService.record(
      { action: 'UPDATE', module: 'asset', entityType: 'AssetCategory', entityId: id, description: `แก้ไขประเภทครุภัณฑ์ ${category.nameTh}` },
      ctx,
    );

    return category;
  }

  async removeCategory(id: string, ctx: IRequestContext) {
    const count = await this.repo.countAssetsByCategory(id);
    if (count > 0) {
      throw new ConflictError('ไม่สามารถลบประเภทครุภัณฑ์ที่ยังมีครุภัณฑ์ผูกอยู่ได้ กรุณาย้ายครุภัณฑ์ไปประเภทอื่นก่อน');
    }

    await this.repo.deactivateCategory(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'asset', entityType: 'AssetCategory', entityId: id, description: 'ปิดใช้งานประเภทครุภัณฑ์' },
      ctx,
    );
  }

  async getById(id: string) {
    const asset = await this.repo.findById(id);
    if (!asset) throw new NotFoundError('ไม่พบครุภัณฑ์');
    return asset;
  }

  async getHistory(id: string) {
    const asset = await this.repo.findByIdBasic(id);
    if (!asset) throw new NotFoundError('ไม่พบครุภัณฑ์');
    return this.repo.repairHistory(id);
  }

  async create(dto: CreateAssetDto, ctx: IRequestContext) {
    const assetNumber = await runningNumberService.getNextNumber('ASSET');

    const asset = await this.repo.create({
      id: randomUUID(),
      assetNumber,
      govAssetNumber: dto.govAssetNumber,
      serialNumber: dto.serialNumber,
      model: dto.model,
      brand: dto.brand,
      categoryId: dto.categoryId,
      departmentId: dto.departmentId,
      buildingId: dto.buildingId,
      floorId: dto.floorId,
      roomId: dto.roomId,
      locationNote: dto.locationNote,
      purchaseDate: dto.purchaseDate,
      warrantyExpireDate: dto.warrantyExpireDate,
      vendorId: dto.vendorId,
      price: dto.price,
      ownerUserId: dto.ownerUserId,
      remark: dto.remark,
      createdBy: ctx.user.id,
    });

    await auditLogService.record(
      { action: 'CREATE', module: 'asset', entityType: 'Asset', entityId: asset.id, description: `สร้างครุภัณฑ์ ${asset.assetNumber}` },
      ctx,
    );

    return asset;
  }

  async update(id: string, dto: UpdateAssetDto, ctx: IRequestContext) {
    const existing = await this.repo.findByIdBasic(id);
    if (!existing) throw new NotFoundError('ไม่พบครุภัณฑ์');

    const asset = await this.repo.update(id, { ...dto, updatedBy: ctx.user.id });

    await auditLogService.record(
      { action: 'UPDATE', module: 'asset', entityType: 'Asset', entityId: id, beforeData: existing, afterData: asset },
      ctx,
    );

    return asset;
  }

  async remove(id: string, ctx: IRequestContext) {
    const existing = await this.repo.findByIdBasic(id);
    if (!existing) throw new NotFoundError('ไม่พบครุภัณฑ์');

    await this.repo.softDelete(id);
    await auditLogService.record(
      { action: 'DELETE', module: 'asset', entityType: 'Asset', entityId: id, description: `ลบครุภัณฑ์ ${existing.assetNumber}` },
      ctx,
    );
  }

  async addPhotos(id: string, files: Express.Multer.File[], ctx: IRequestContext) {
    const existing = await this.repo.findByIdBasic(id);
    if (!existing) throw new NotFoundError('ไม่พบครุภัณฑ์');

    const photos = await Promise.all(
      files.map((file) =>
        this.repo.addPhoto({
          id: randomUUID(),
          assetId: id,
          fileUrl: `${env.API_PREFIX}/files/assets/${file.filename}`,
          uploadedBy: ctx.user.id,
        }),
      ),
    );

    await auditLogService.record(
      { action: 'UPDATE', module: 'asset', entityType: 'Asset', entityId: id, description: `อัปโหลดรูปครุภัณฑ์ ${photos.length} รูป` },
      ctx,
    );

    return photos;
  }

  async removePhoto(assetId: string, photoId: string, ctx: IRequestContext) {
    const photo = await this.repo.findPhotoById(photoId);
    if (!photo || photo.assetId !== assetId) throw new NotFoundError('ไม่พบรูปภาพนี้');

    await this.repo.deletePhoto(photoId);

    await auditLogService.record(
      { action: 'DELETE', module: 'asset', entityType: 'Asset', entityId: assetId, description: 'ลบรูปครุภัณฑ์' },
      ctx,
    );
  }
}
