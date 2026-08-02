import type { Request, Response } from 'express';
import { vendorRepairOrderService } from '@modules/vendor-repair-orders/services/vendorRepairOrder.service';
import type {
  CreateVendorOrderDto,
  ListVendorOrdersQueryDto,
  UpdateVendorOrderDto,
} from '@modules/vendor-repair-orders/dto/vendorRepairOrder.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import { env } from '@config/env';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listVendorOrders = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorRepairOrderService.list(req.query as unknown as ListVendorOrdersQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const getVendorOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await vendorRepairOrderService.getById(req.params.id);
  sendSuccess(res, order);
});

export const createVendorOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await vendorRepairOrderService.create(req.body as CreateVendorOrderDto, contextOf(req));
  sendCreated(res, order);
});

export const updateVendorOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await vendorRepairOrderService.update(req.params.id, req.body as UpdateVendorOrderDto, contextOf(req));
  sendSuccess(res, order);
});

export const uploadQuotationFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('กรุณาแนบไฟล์ใบเสนอราคา');
  const fileUrl = `${env.API_PREFIX}/files/vendor-docs/${req.file.filename}`;
  const order = await vendorRepairOrderService.setQuotationFile(req.params.id, fileUrl, contextOf(req));
  sendSuccess(res, order);
});

export const uploadInvoiceFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('กรุณาแนบไฟล์ใบแจ้งหนี้/ใบเสร็จ');
  const fileUrl = `${env.API_PREFIX}/files/vendor-docs/${req.file.filename}`;
  const order = await vendorRepairOrderService.setInvoiceFile(req.params.id, fileUrl, contextOf(req));
  sendSuccess(res, order);
});
