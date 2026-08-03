import type { Request, Response } from 'express';
import { vendorService } from '@modules/vendors/services/vendor.service';
import type { CreateVendorDto, ExportVendorsQueryDto, ListVendorsQueryDto, UpdateVendorDto } from '@modules/vendors/dto/vendor.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'รหัส', key: 'code', width: 14 },
  { header: 'ชื่อบริษัท/ร้าน', key: 'name', width: 30 },
  { header: 'ผู้ติดต่อ', key: 'contactPerson', width: 20 },
  { header: 'เบอร์โทร', key: 'phone', width: 16 },
  { header: 'อีเมล', key: 'email', width: 24 },
  { header: 'ที่อยู่', key: 'address', width: 34 },
  { header: 'เลขผู้เสียภาษี', key: 'taxId', width: 18 },
  { header: 'สถานะ', key: 'statusTh', width: 14 },
];

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.list(req.query as unknown as ListVendorsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const exportVendors = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportVendorsQueryDto;
  const items = await vendorService.listForExport({ keyword: query.keyword, activeOnly: query.activeOnly });

  const rows = items.map((v) => ({
    code: v.code,
    name: v.name,
    contactPerson: v.contactPerson ?? '',
    phone: v.phone ?? '',
    email: v.email ?? '',
    address: v.address ?? '',
    taxId: v.taxId ?? '',
    statusTh: v.isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน',
  }));

  const filenameBase = `vendors-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Vendors', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
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
