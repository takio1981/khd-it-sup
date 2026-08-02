import type { Request, Response } from 'express';
import { sparePartService } from '@modules/spare-parts/services/sparePart.service';
import type {
  CreateSparePartDto,
  ListSparePartsQueryDto,
  ListTransactionsQueryDto,
  RecordTransactionDto,
  UpdateSparePartDto,
} from '@modules/spare-parts/dto/sparePart.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listSpareParts = asyncHandler(async (req: Request, res: Response) => {
  const result = await sparePartService.list(req.query as unknown as ListSparePartsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const getSparePart = asyncHandler(async (req: Request, res: Response) => {
  const part = await sparePartService.getById(req.params.id);
  sendSuccess(res, part);
});

export const createSparePart = asyncHandler(async (req: Request, res: Response) => {
  const part = await sparePartService.create(req.body as CreateSparePartDto, contextOf(req));
  sendCreated(res, part);
});

export const updateSparePart = asyncHandler(async (req: Request, res: Response) => {
  const part = await sparePartService.update(req.params.id, req.body as UpdateSparePartDto, contextOf(req));
  sendSuccess(res, part);
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListTransactionsQueryDto;
  const result = await sparePartService.listTransactions(query);
  sendSuccess(res, result.items, 200, result.meta);
});

export const listSparePartTransactions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListTransactionsQueryDto;
  const result = await sparePartService.listTransactions({ ...query, sparePartId: req.params.id });
  sendSuccess(res, result.items, 200, result.meta);
});

export const recordTransaction = asyncHandler(async (req: Request, res: Response) => {
  const txn = await sparePartService.recordTransaction(req.params.id, req.body as RecordTransactionDto, contextOf(req));
  sendCreated(res, txn);
});
