import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/database/prisma';

const loanInclude = {
  asset: { select: { id: true, assetNumber: true, brand: true, model: true, category: { select: { nameTh: true } } } },
  borrower: { select: { id: true, fullName: true, email: true } },
  recorder: { select: { id: true, fullName: true } },
  returner: { select: { id: true, fullName: true } },
} satisfies Prisma.AssetLoanInclude;

export interface IAssetLoanFilter {
  status?: 'BORROWED' | 'OVERDUE' | 'RETURNED';
  assetId?: string;
  keyword?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

function buildWhere(filter: IAssetLoanFilter): Prisma.AssetLoanWhereInput {
  const where: Prisma.AssetLoanWhereInput = {};

  if (filter.assetId) {
    where.assetId = filter.assetId;
  }

  if (filter.status === 'RETURNED') {
    where.actualReturnDate = { not: null };
  } else if (filter.status === 'OVERDUE') {
    where.actualReturnDate = null;
    where.expectedReturnDate = { lt: new Date() };
  } else if (filter.status === 'BORROWED') {
    where.actualReturnDate = null;
    where.OR = [{ expectedReturnDate: null }, { expectedReturnDate: { gte: new Date() } }];
  }

  if (filter.dateFrom || filter.dateTo) {
    where.borrowDate = { gte: filter.dateFrom, lte: filter.dateTo };
  }

  if (filter.keyword) {
    const keywordFilter: Prisma.AssetLoanWhereInput = {
      OR: [
        { asset: { assetNumber: { contains: filter.keyword } } },
        { asset: { brand: { contains: filter.keyword } } },
        { asset: { model: { contains: filter.keyword } } },
        { borrower: { fullName: { contains: filter.keyword } } },
      ],
    };
    where.AND = where.AND ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), keywordFilter] : [keywordFilter];
  }

  return where;
}

export class AssetLoanRepository {
  async findMany(filter: IAssetLoanFilter, skip: number, take: number) {
    const where = buildWhere(filter);
    const [items, total] = await Promise.all([
      prisma.assetLoan.findMany({ where, include: loanInclude, orderBy: { borrowDate: 'desc' }, skip, take }),
      prisma.assetLoan.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return prisma.assetLoan.findUnique({ where: { id }, include: loanInclude });
  }

  async findActiveByAsset(assetId: string) {
    return prisma.assetLoan.findFirst({ where: { assetId, actualReturnDate: null } });
  }

  async create(data: Prisma.AssetLoanUncheckedCreateInput) {
    return prisma.assetLoan.create({ data, include: loanInclude });
  }

  async markReturned(id: string, returnedBy: string, conditionOnReturn?: string) {
    return prisma.assetLoan.update({
      where: { id },
      data: { actualReturnDate: new Date(), returnedBy, conditionOnReturn },
      include: loanInclude,
    });
  }

  async update(id: string, data: Prisma.AssetLoanUncheckedUpdateInput) {
    return prisma.assetLoan.update({ where: { id }, data, include: loanInclude });
  }

  async delete(id: string) {
    await prisma.assetLoan.delete({ where: { id } });
  }

  async getStats() {
    const [total, returned, overdue] = await Promise.all([
      prisma.assetLoan.count(),
      prisma.assetLoan.count({ where: { actualReturnDate: { not: null } } }),
      prisma.assetLoan.count({ where: { actualReturnDate: null, expectedReturnDate: { lt: new Date() } } }),
    ]);
    const borrowed = total - returned;
    return { total, borrowed: borrowed - overdue, overdue, returned };
  }

  /** ใช้โดย job แจ้งเตือนยืมเกินกำหนดคืนรายวัน (ดู services/assetLoanReminder.job.ts) */
  async findOverdueLoans() {
    return prisma.assetLoan.findMany({
      where: { actualReturnDate: null, expectedReturnDate: { lt: new Date() } },
      include: loanInclude,
    });
  }

  async findAllForChart() {
    return prisma.assetLoan.findMany({
      select: { asset: { select: { assetNumber: true, brand: true, model: true } }, borrower: { select: { fullName: true } } },
    });
  }

  /** ใช้สำหรับรายงานยืม-คืนแยกรายหน่วยงาน (หน่วยงานของผู้ยืม) — aggregate ใน service layer เหมือน getChartData() */
  async findAllForDepartmentReport(filter: IAssetLoanFilter) {
    const where = buildWhere(filter);
    return prisma.assetLoan.findMany({
      where,
      select: { borrower: { select: { department: { select: { id: true, nameTh: true } } } } },
    });
  }
}
