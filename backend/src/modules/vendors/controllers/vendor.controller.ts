import type { Request, Response } from 'express';
import { vendorService } from '@modules/vendors/services/vendor.service';
import type { CreateVendorDto, ListVendorsQueryDto, UpdateVendorDto } from '@modules/vendors/dto/vendor.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.list(req.query as unknown as ListVendorsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.getById(req.params.id);
  sendSuccess(res, vendor);
});

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.create(req.body as CreateVendorDto, contextOf(req));
  sendCreated(res, vendor);
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorService.update(req.params.id, req.body as UpdateVendorDto, contextOf(req));
  sendSuccess(res, vendor);
});
