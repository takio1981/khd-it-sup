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

    const { loans, ...rest } = asset;
    const activeLoan = loans[0]
      ? {
          id: loans[0].id,
          borrowerId: loans[0].borrower.id,
          borrowerName: loans[0].borrower.fullName,
          borrowDate: loans[0].borrowDate,
          expectedReturnDate: loans[0].expectedReturnDate,
        }
      : null;

    return { ...rest, activeLoan };
  }
}
