import type { Request, Response } from 'express';
import { QrCodeService } from '@modules/qrcode/services/qrcode.service';
import type { BulkPrintDto } from '@modules/qrcode/dto/qrcode.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

const qrCodeService = new QrCodeService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const generateQrCode = asyncHandler(async (req: Request, res: Response) => {
  const result = await qrCodeService.generate(req.params.assetId, contextOf(req));
  sendSuccess(res, result);
});

export const printQrCode = asyncHandler(async (req: Request, res: Response) => {
  const { buffer, assetNumber } = await qrCodeService.getPrintablePng(req.params.assetId);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="qr-${assetNumber}.png"`);
  res.send(buffer);
});

export const bulkPrintQrCode = asyncHandler(async (req: Request, res: Response) => {
  const { assetIds } = req.body as BulkPrintDto;
  const results = await qrCodeService.bulkPrint(assetIds);
  sendSuccess(res, results);
});

export const resolveQrCode = asyncHandler(async (req: Request, res: Response) => {
  const asset = await qrCodeService.resolve(
    req.params.token,
    req.user?.id ?? null,
    req.ip ?? 'unknown',
    req.headers['user-agent'] ?? 'unknown',
  );
  sendSuccess(res, asset);
});
