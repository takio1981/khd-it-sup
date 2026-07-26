import type { Request, Response } from 'express';
import { AssetService } from '@modules/assets/services/asset.service';
import type {
  CreateAssetDto,
  CreateCategoryDto,
  ListAssetsQueryDto,
  UpdateAssetDto,
  UpdateCategoryDto,
} from '@modules/assets/dto/asset.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import type { IRequestContext } from '@common/interfaces';

const assetService = new AssetService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const result = await assetService.list(req.query as unknown as ListAssetsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await assetService.listCategories();
  sendSuccess(res, categories);
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
