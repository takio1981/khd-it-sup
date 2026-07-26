import type { Request, Response } from 'express';
import { notificationService } from '@modules/notifications/services/notification.service';
import type { ListNotificationLogsQueryDto } from '@modules/notifications/dto/notification.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';

export const listNotificationLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.listLogs(req.query as unknown as ListNotificationLogsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});
