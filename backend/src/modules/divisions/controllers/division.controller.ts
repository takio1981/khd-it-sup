import type { Request, Response } from 'express';
import { DivisionService } from '@modules/divisions/services/division.service';
import type { CreateDivisionDto, UpdateDivisionDto } from '@modules/divisions/dto/division.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

const divisionService = new DivisionService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listDivisions = asyncHandler(async (_req: Request, res: Response) => {
  const divisions = await divisionService.list();
  sendSuccess(res, divisions);
});

export const getDivision = asyncHandler(async (req: Request, res: Response) => {
  const division = await divisionService.getById(req.params.id);
  sendSuccess(res, division);
});

export const createDivision = asyncHandler(async (req: Request, res: Response) => {
  const division = await divisionService.create(req.body as CreateDivisionDto, contextOf(req));
  sendCreated(res, division);
});

export const updateDivision = asyncHandler(async (req: Request, res: Response) => {
  const division = await divisionService.update(req.params.id, req.body as UpdateDivisionDto, contextOf(req));
  sendSuccess(res, division);
});

export const deleteDivision = asyncHandler(async (req: Request, res: Response) => {
  await divisionService.remove(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ปิดใช้งานแผนกสำเร็จ' });
});
