import type { Request, Response } from 'express';
import { AssetLoanService } from '@modules/asset-loans/services/assetLoan.service';
import type {
  CreateAssetLoanDto,
  ListAssetLoansQueryDto,
  ReturnAssetLoanDto,
  UpdateAssetLoanDto,
} from '@modules/asset-loans/dto/assetLoan.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

const assetLoanService = new AssetLoanService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listAssetLoans = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListAssetLoansQueryDto;
  const result = await assetLoanService.list(query);
  sendSuccess(res, result.items, 200, result.meta);
});

export const getAssetLoanStats = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await assetLoanService.getStats());
});

export const getAssetLoanChartData = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await assetLoanService.getChartData());
});

export const getAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await assetLoanService.getById(req.params.id));
});

export const createAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.create(req.body as CreateAssetLoanDto, contextOf(req));
  sendCreated(res, loan);
});

export const updateAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.update(req.params.id, req.body as UpdateAssetLoanDto, contextOf(req));
  sendSuccess(res, loan);
});

export const deleteAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  await assetLoanService.remove(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ลบรายการยืมสำเร็จ' });
});

export const returnAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.returnLoan(req.params.id, req.body as ReturnAssetLoanDto, contextOf(req));
  sendSuccess(res, loan);
});
