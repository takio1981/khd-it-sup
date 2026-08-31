import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';
import type { INormalizedPagination } from '@common/utils/pagination';

export interface IAssetListFilter {
  categoryId?: string;
  departmentId?: string;
  status?: string;
  keyword?: string;
}

const assetListInclude = {
  category: { select: { id: true, code: true, nameTh: true, icon: true } },
  department: { select: { id: true, nameTh: true } },
  building: { select: { id: true, name: true } },
  floor: { select: { id: true, name: true } },
  room: { select: { id: true, name: true } },
  qrcode: { select: { id: true, qrToken: true, isActive: true } },
} satisfies Prisma.AssetInclude;

const assetDetailInclude = {
  ...assetListInclude,
  vendor: { select: { id: true, name: true } },
  owner: { select: { id: true, fullName: true, username: true } },
  photos: { orderBy: { uploadedAt: 'desc' } },
} satisfies Prisma.AssetInclude;

function buildWhere(filter: IAssetListFilter): Prisma.AssetWhereInput {
  return {
    deletedAt: null,
    categoryId: filter.categoryId,
    departmentId: filter.departmentId,
    status: filter.status as Prisma.EnumAssetStatusFilter['equals'],
    ...(filter.keyword
      ? {
          OR: [
            { assetNumber: { contains: filter.keyword } },
            { govAssetNumber: { contains: filter.keyword } },
            { serialNumber: { contains: filter.keyword } },
            { model: { contains: filter.keyword } },
            { brand: { contains: filter.keyword } },
          ],
        }
      : {}),
  };
}

export class AssetRepository {
  async findMany(filter: IAssetListFilter, pagination: INormalizedPagination) {
    const where = buildWhere(filter);
    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: assetListInclude,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.asset.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return prisma.asset.findFirst({ where: { id, deletedAt: null }, include: assetDetailInclude });
  }

  async findByIdBasic(id: string) {
    return prisma.asset.findFirst({ where: { id, deletedAt: null } });
  }

  async create(data: Prisma.AssetUncheckedCreateInput) {
    return prisma.asset.create({ data, include: assetDetailInclude });
  }

  /** ใช้เฉพาะ equipment-sync — โหลด map ทุก asset ที่มี gov_asset_number ครั้งเดียวก่อนเริ่ม sync แทน query ทีละแถว */
  async findAllWithGovAssetNumber() {
    return prisma.asset.findMany({
      where: { govAssetNumber: { not: null } },
      select: { id: true, govAssetNumber: true, deletedAt: true, externalSource: true },
    });
  }

  async createMinimal(data: Prisma.AssetUncheckedCreateInput) {
    return prisma.asset.create({ data, select: { id: true } });
  }

  async updateMinimal(id: string, data: Prisma.AssetUncheckedUpdateInput) {
    return prisma.asset.update({ where: { id }, data, select: { id: true } });
  }

  async update(id: string, data: Prisma.AssetUncheckedUpdateInput) {
    return prisma.asset.update({ where: { id }, data, include: assetDetailInclude });
  }

  async softDelete(id: string) {
    return prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listCategories() {
    return prisma.assetCategory.findMany({ where: { isActive: true }, orderBy: { nameTh: 'asc' } });
  }

  async findCategoryByCode(code: string) {
    return prisma.assetCategory.findUnique({ where: { code } });
  }

  async createCategory(data: Prisma.AssetCategoryUncheckedCreateInput) {
    return prisma.assetCategory.create({ data });
  }

  async updateCategory(id: string, data: Prisma.AssetCategoryUncheckedUpdateInput) {
    return prisma.assetCategory.update({ where: { id }, data });
  }

  async deactivateCategory(id: string) {
    return prisma.assetCategory.update({ where: { id }, data: { isActive: false } });
  }

  async countAssetsByCategory(categoryId: string): Promise<number> {
    return prisma.asset.count({ where: { categoryId, deletedAt: null } });
  }

  async addPhoto(data: Prisma.AssetPhotoUncheckedCreateInput) {
    return prisma.assetPhoto.create({ data });
  }

  async findPhotoById(photoId: string) {
    return prisma.assetPhoto.findUnique({ where: { id: photoId } });
  }

  async deletePhoto(photoId: string) {
    await prisma.assetPhoto.delete({ where: { id: photoId } });
  }

  async repairHistory(assetId: string) {
    return prisma.repairTicket.findMany({
      where: { assetId },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        urgency: true,
        description: true,
        createdAt: true,
        closedAt: true,
        assignedTechnician: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
