import type { Request, Response } from 'express';
import { equipmentSyncService } from '@modules/equipment-sync/services/equipmentSync.service';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const getStatus = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, equipmentSyncService.getStatus());
});

export const triggerSync = asyncHandler(async (req: Request, res: Response) => {
  equipmentSyncService.startManualRun(contextOf(req));
  sendSuccess(res, { started: true }, 202);
});
