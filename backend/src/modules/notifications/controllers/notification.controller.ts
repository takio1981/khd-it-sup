import type { Request, Response } from 'express';
import { notificationService } from '@modules/notifications/services/notification.service';
import type { ListMyNotificationsQueryDto, ListNotificationLogsQueryDto } from '@modules/notifications/dto/notification.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';

export const listNotificationLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.listLogs(req.query as unknown as ListNotificationLogsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const listMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.listMyNotifications(req.user!.id, req.query as unknown as ListMyNotificationsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const getMyUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await notificationService.getMyUnreadCount(req.user!.id);
  sendSuccess(res, { count });
});

export const markMyNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markMyNotificationRead(req.user!.id, req.params.id);
  sendSuccess(res, { message: 'อ่านแล้ว' });
});

export const markAllMyNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAllMyNotificationsRead(req.user!.id);
  sendSuccess(res, { message: 'อ่านทั้งหมดแล้ว' });
});
