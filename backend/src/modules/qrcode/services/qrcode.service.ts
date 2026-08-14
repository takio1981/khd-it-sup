import fs from 'node:fs/promises';
import path from 'node:path';
import { QrCodeRepository } from '@modules/qrcode/repositories/qrcode.repository';
import { encryptAssetId, decryptAssetId } from '@infrastructure/qrcode/qrToken.util';
import { generateQrDataUrl, generateQrPngBuffer } from '@infrastructure/qrcode/qrImage.util';
import { env } from '@config/env';
import { NotFoundError } from '@common/errors';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { IRequestContext } from '@common/interfaces';

function buildScanUrl(token: string): string {
  return `${env.FRONTEND_BASE_URL}/qr/scan/${encodeURIComponent(token)}`;
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * ฝังรูปครุภัณฑ์เป็น base64 data URL ตรงใน response ของหน้าสแกน QR (public, ไม่ login) แทนการอ้าง fileUrl เดิม
 * เพราะไฟล์แนบทั้งหมดถูก serve ผ่าน /files/:subdir/:filename ที่บังคับ authenticate เสมอ (ดู serveFile.controller.ts)
 * — ผู้สแกนที่ยังไม่ login จะโหลดรูปไม่ได้ถ้าใช้ fileUrl ตรงๆ อ่านไฟล์ไม่ได้ (เช่นถูกลบไปแล้ว) ให้ข้ามรูปนั้นแทนที่จะ throw
 */
async function toPhotoDataUrl(fileUrl: string): Promise<string | null> {
  const filename = path.basename(fileUrl);
  const mime = IMAGE_MIME_BY_EXT[path.extname(filename).toLowerCase()];
  if (!mime) return null;

  try {
    const filePath = path.resolve(env.UPLOAD_DIR, 'assets', filename);
    const buffer = await fs.readFile(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export class QrCodeService {
  private readonly repo = new QrCodeRepository();

  async generate(assetId: string, ctx: IRequestContext) {
    const asset = await this.repo.findAssetById(assetId);
    if (!asset) throw new NotFoundError('ไม่พบครุภัณฑ์');

    const token = encryptAssetId(assetId);
    const record = await this.repo.upsertQrToken(assetId, token, ctx.user.id);

    await auditLogService.record(
      { action: 'CREATE', module: 'qrcode', entityType: 'Asset', entityId: assetId, description: `สร้าง QR Code สำหรับครุภัณฑ์ ${asset.assetNumber}` },
      ctx,
    );

    return {
      assetId,
      assetNumber: asset.assetNumber,
      qrToken: record.qrToken,
      scanUrl: buildScanUrl(record.qrToken),
      dataUrl: await generateQrDataUrl(buildScanUrl(record.qrToken)),
    };
  }

  async getPrintablePng(assetId: string): Promise<{ buffer: Buffer; assetNumber: string }> {
    const asset = await this.repo.findAssetById(assetId);
    if (!asset) throw new NotFoundError('ไม่พบครุภัณฑ์');

    let qr = await this.repo.findQrByAssetId(assetId);
    if (!qr) {
      // ยังไม่เคยสร้าง QR มาก่อน — สร้างให้อัตโนมัติด้วย system เพื่อไม่ให้ผู้ใช้ต้องเรียก generate ก่อนเสมอ
      const token = encryptAssetId(assetId);
      qr = await this.repo.upsertQrToken(assetId, token, 'system');
    }

    const buffer = await generateQrPngBuffer(buildScanUrl(qr.qrToken));
    return { buffer, assetNumber: asset.assetNumber };
  }

  async bulkPrint(assetIds: string[]): Promise<{ assetId: string; assetNumber: string; dataUrl: string }[]> {
    const results = await Promise.all(
      assetIds.map(async (assetId) => {
        const asset = await this.repo.findAssetById(assetId);
        if (!asset) return null;

        let qr = await this.repo.findQrByAssetId(assetId);
        if (!qr) {
          const token = encryptAssetId(assetId);
          qr = await this.repo.upsertQrToken(assetId, token, 'system');
        }

        return {
          assetId,
          assetNumber: asset.assetNumber,
          dataUrl: await generateQrDataUrl(buildScanUrl(qr.qrToken)),
        };
      }),
    );

    return results.filter((r): r is { assetId: string; assetNumber: string; dataUrl: string } => r !== null);
  }

  /** Public endpoint (ไม่ต้อง login) — ใช้ตอนสแกน QR จริง ถอดรหัส token แล้วคืนข้อมูลครุภัณฑ์แบบย่อ */
  async resolve(token: string, scannedByUserId: string | null, ipAddress: string, userAgent: string) {
    let assetId: string;
    try {
      assetId = decryptAssetId(token);
    } catch {
      throw new NotFoundError('QR Code ไม่ถูกต้องหรือหมดอายุ');
    }

    const qr = await this.repo.findQrByToken(token);
    if (!qr || !qr.isActive || qr.assetId !== assetId) {
      throw new NotFoundError('QR Code นี้ไม่ได้ใช้งานแล้วหรือไม่ถูกต้อง');
    }

    const asset = await this.repo.findAssetSummaryForScan(assetId);
    if (!asset) throw new NotFoundError('ไม่พบครุภัณฑ์ที่เชื่อมโยงกับ QR Code นี้');

    await this.repo.logScan(assetId, scannedByUserId, ipAddress, userAgent);

    const { loans, photos, ...rest } = asset;
    const activeLoan = loans[0]
      ? {
          id: loans[0].id,
          borrowerId: loans[0].borrower.id,
          borrowerName: loans[0].borrower.fullName,
          borrowDate: loans[0].borrowDate,
          expectedReturnDate: loans[0].expectedReturnDate,
        }
      : null;

    const resolvedPhotos = (
      await Promise.all(
        photos.map(async (p) => ({ id: p.id, caption: p.caption, dataUrl: await toPhotoDataUrl(p.fileUrl) })),
      )
    ).filter((p): p is { id: string; caption: string | null; dataUrl: string } => p.dataUrl !== null);

    return { ...rest, activeLoan, photos: resolvedPhotos };
  }
}
