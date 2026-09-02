import type { Request, Response } from 'express';
import { AssetService } from '@modules/assets/services/asset.service';
import type {
  CreateAssetDto,
  CreateCategoryDto,
  ExportAssetsQueryDto,
  ListAssetsQueryDto,
  UpdateAssetDto,
  UpdateCategoryDto,
} from '@modules/assets/dto/asset.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import type { IRequestContext } from '@common/interfaces';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';

const assetService = new AssetService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

const ASSET_STATUS_LABEL_TH: Record<string, string> = {
  ACTIVE: 'ใช้งานปกติ',
  IN_REPAIR: 'อยู่ระหว่างซ่อม',
  WAITING_PARTS: 'รออะไหล่',
  MAINTENANCE: 'ซ่อมบำรุง',
  RESERVED: 'สำรองใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
  DISPOSED: 'จำหน่ายแล้ว',
  LOST: 'สูญหาย',
};

const ASSET_ACQUISITION_TYPE_LABEL_TH: Record<string, string> = {
  PURCHASE: 'ซื้อ',
  LEASE_TO_OWN: 'เช่า-ซื้อ',
  LEASE_USE: 'เช่า-ใช้',
  DONATED: 'บริจาค/ได้รับบริจาค',
  BORROWED: 'ยืมตัวชั่วคราว',
  UNKNOWN: 'ไม่ทราบ',
};

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'เลขครุภัณฑ์', key: 'assetNumber', width: 18 },
  { header: 'เลขครุภัณฑ์ราชการ', key: 'govAssetNumber', width: 20 },
  { header: 'ประเภท', key: 'category', width: 18 },
  { header: 'ยี่ห้อ/รุ่น', key: 'brandModel', width: 26 },
  { header: 'เลขซีเรียล', key: 'serialNumber', width: 20 },
  { header: 'สถานะ', key: 'statusTh', width: 16 },
  { header: 'ประเภทการได้มา', key: 'acquisitionTypeTh', width: 16 },
  { header: 'หน่วยงาน', key: 'department', width: 24 },
  { header: 'สถานที่', key: 'location', width: 24 },
  { header: 'ผู้รับผิดชอบ', key: 'owner', width: 24 },
  { header: 'ราคา', key: 'price', width: 14 },
  { header: 'วันที่ซื้อ', key: 'purchaseDate', width: 16 },
  { header: 'หน่วยนับ', key: 'unitType', width: 12 },
  { header: 'ปีงบประมาณ', key: 'budgetYear', width: 12 },
  { header: 'รหัสจำแนกครุภัณฑ์ราชการ', key: 'equipClassificationCode', width: 16 },
  { header: 'ชื่อจำแนกครุภัณฑ์ราชการ', key: 'equipClassificationName', width: 30 },
  { header: 'แหล่งที่มา', key: 'externalSource', width: 18 },
];

function formatDateTh(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('th-TH', { dateStyle: 'medium' });
}

export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const result = await assetService.list(req.query as unknown as ListAssetsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const exportAssets = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportAssetsQueryDto;
  const items = await assetService.listForExport(query);

  const rows = items.map((a) => ({
    assetNumber: a.assetNumber,
    govAssetNumber: a.govAssetNumber ?? '',
    category: a.category?.nameTh ?? '',
    brandModel: [a.brand, a.model].filter(Boolean).join(' / '),
    serialNumber: a.serialNumber ?? '',
    statusTh: ASSET_STATUS_LABEL_TH[a.status] ?? a.status,
    acquisitionTypeTh: ASSET_ACQUISITION_TYPE_LABEL_TH[a.acquisitionType] ?? a.acquisitionType,
    department: a.department?.nameTh ?? '',
    location: [a.building?.name, a.floor?.name, a.room?.name].filter(Boolean).join(' / '),
    owner: a.owner?.fullName ?? '',
    price: a.price ?? '',
    purchaseDate: formatDateTh(a.purchaseDate),
    unitType: a.unitType ?? '',
    budgetYear: a.budgetYear ?? '',
    equipClassificationCode: a.equipClassificationCode ?? '',
    equipClassificationName: a.equipClassificationName ?? '',
    externalSource: a.externalSource ?? '',
  }));

  const filenameBase = `assets-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Assets', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await assetService.listCategories();
  sendSuccess(res, categories);
});

export const listBudgetYears = asyncHandler(async (_req: Request, res: Response) => {
  const years = await assetService.listBudgetYears();
  sendSuccess(res, years);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await assetService.createCategory(req.body as CreateCategoryDto, contextOf(req));
  sendCreated(res, category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await assetService.updateCategory(req.params.id, req.body as UpdateCategoryDto, contextOf(req));
  sendSuccess(res, category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await assetService.removeCategory(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ปิดใช้งานประเภทครุภัณฑ์สำเร็จ' });
});

export const getAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.getById(req.params.id);
  sendSuccess(res, asset);
});

export const getAssetHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await assetService.getHistory(req.params.id);
  sendSuccess(res, history);
});

export const createAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.create(req.body as CreateAssetDto, contextOf(req));
  sendCreated(res, asset);
});

export const updateAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.update(req.params.id, req.body as UpdateAssetDto, contextOf(req));
  sendSuccess(res, asset);
});

export const deleteAsset = asyncHandler(async (req: Request, res: Response) => {
  await assetService.remove(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ลบครุภัณฑ์สำเร็จ' });
});

export const uploadAssetPhotos = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    throw new BadRequestError('กรุณาแนบไฟล์รูปภาพอย่างน้อย 1 ไฟล์');
  }
  const photos = await assetService.addPhotos(req.params.id, files, contextOf(req));
  sendCreated(res, photos);
});

export const deleteAssetPhoto = asyncHandler(async (req: Request, res: Response) => {
  await assetService.removePhoto(req.params.id, req.params.photoId, contextOf(req));
  sendSuccess(res, { message: 'ลบรูปครุภัณฑ์สำเร็จ' });
});
