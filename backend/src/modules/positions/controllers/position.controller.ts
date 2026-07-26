import type { Request, Response } from 'express';
import { PositionService } from '@modules/positions/services/position.service';
import type { CreatePositionDto, UpdatePositionDto } from '@modules/positions/dto/position.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

const positionService = new PositionService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listPositions = asyncHandler(async (_req: Request, res: Response) => {
  const positions = await positionService.list();
  sendSuccess(res, positions);
});

export const getPosition = asyncHandler(async (req: Request, res: Response) => {
  const position = await positionService.getById(req.params.id);
  sendSuccess(res, position);
});

export const createPosition = asyncHandler(async (req: Request, res: Response) => {
  const position = await positionService.create(req.body as CreatePositionDto, contextOf(req));
  sendCreated(res, position);
});

export const updatePosition = asyncHandler(async (req: Request, res: Response) => {
  const position = await positionService.update(req.params.id, req.body as UpdatePositionDto, contextOf(req));
  sendSuccess(res, position);
});

export const deletePosition = asyncHandler(async (req: Request, res: Response) => {
  await positionService.remove(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ปิดใช้งานตำแหน่งงานสำเร็จ' });
});
