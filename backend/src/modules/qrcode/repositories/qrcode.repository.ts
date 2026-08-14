import { randomUUID } from 'node:crypto';
import { prisma } from '@infrastructure/database/prisma';

export class QrCodeRepository {
  async findAssetById(assetId: string) {
    return prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
      include: { category: { select: { nameTh: true } }, department: { select: { nameTh: true } } },
    });
  }

  async findQrByAssetId(assetId: string) {
    return prisma.assetQrcode.findUnique({ where: { assetId } });
  }

  async findQrByToken(token: string) {
    return prisma.assetQrcode.findUnique({ where: { qrToken: token } });
  }

  async upsertQrToken(assetId: string, qrToken: string, generatedBy: string) {
    return prisma.assetQrcode.upsert({
      where: { assetId },
      update: { qrToken, isActive: true, generatedBy, generatedAt: new Date() },
      create: { id: randomUUID(), assetId, qrToken, generatedBy },
    });
  }

  async logScan(assetId: string, scannedBy: string | null, ipAddress: string, userAgent: string) {
    return prisma.qrScanLog.create({
      data: { id: randomUUID(), assetId, scannedBy, ipAddress, userAgent },
    });
  }

  async findAssetSummaryForScan(assetId: string) {
    return prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
      select: {
        id: true,
        assetNumber: true,
        govAssetNumber: true,
        model: true,
        brand: true,
        status: true,
        photoUrl: true,
        category: { select: { nameTh: true, nameEn: true, icon: true } },
        department: { select: { nameTh: true } },
        room: { select: { name: true } },
        floor: { select: { name: true } },
        building: { select: { name: true } },
        repairTickets: {
          select: { id: true, ticketNumber: true, status: true, createdAt: true, closedAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        loans: {
          where: { actualReturnDate: null },
          select: {
            id: true,
            borrowDate: true,
            expectedReturnDate: true,
            borrower: { select: { id: true, fullName: true } },
          },
          orderBy: { borrowDate: 'desc' },
          take: 1,
        },
      },
    });
  }
}
