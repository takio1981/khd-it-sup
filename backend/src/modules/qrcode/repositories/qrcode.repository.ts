import { randomUUID } from 'node:crypto';
import { prisma } from '@infrastructure/database/prisma';
import { generateShortCode } from '@infrastructure/qrcode/qrToken.util';

const MAX_SHORT_CODE_RETRIES = 5;

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

  async findQrByShortCode(shortCode: string) {
    return prisma.assetQrcode.findUnique({ where: { shortCode } });
  }

  /** สร้าง/แทนที่ QR token — ออก short_code คู่กันใหม่เสมอ (ผูก 1:1 กับ token ปัจจุบัน) โอกาสชนกันแทบเป็นศูนย์ แต่กันไว้ด้วย retry สุ่มใหม่ */
  async upsertQrToken(assetId: string, qrToken: string, generatedBy: string) {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SHORT_CODE_RETRIES; attempt++) {
      const shortCode = generateShortCode();
      try {
        return await prisma.assetQrcode.upsert({
          where: { assetId },
          update: { qrToken, shortCode, isActive: true, generatedBy, generatedAt: new Date() },
          create: { id: randomUUID(), assetId, qrToken, shortCode, generatedBy },
        });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  /** เติม short_code ให้แถวเดิมที่สร้างก่อนฟีเจอร์นี้ (short_code เป็น NULL) โดยไม่แตะ qr_token เดิม — ป้ายที่พิมพ์ไปแล้วยังใช้งานได้ปกติ */
  async backfillShortCode(id: string) {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SHORT_CODE_RETRIES; attempt++) {
      const shortCode = generateShortCode();
      try {
        return await prisma.assetQrcode.update({ where: { id }, data: { shortCode } });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
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
        serialNumber: true,
        model: true,
        brand: true,
        status: true,
        purchaseDate: true,
        photoUrl: true,
        owner: { select: { fullName: true } },
        photos: {
          select: { id: true, fileUrl: true, caption: true },
          orderBy: { uploadedAt: 'desc' },
          take: 8,
        },
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
