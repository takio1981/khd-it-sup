import type { Request, Response } from 'express';
import { AssetLoanService } from '@modules/asset-loans/services/assetLoan.service';
import type { CreateAssetLoanDto, ListAssetLoansQueryDto, ReturnAssetLoanDto } from '@modules/asset-loans/dto/assetLoan.dto';
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

export const createAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.create(req.body as CreateAssetLoanDto, contextOf(req));
  sendCreated(res, loan);
});

export const returnAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.returnLoan(req.params.id, req.body as ReturnAssetLoanDto, contextOf(req));
  sendSuccess(res, loan);
});
