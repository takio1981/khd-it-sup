import type { Request, Response } from 'express';
import { systemSettingService } from '@modules/settings/services/systemSetting.service';
import { notificationService } from '@modules/notifications/services/notification.service';
import type { TestNotificationDto, UpdateNotificationSettingsDto, UpdateOrgSettingsDto } from '@modules/settings/dto/systemSetting.dto';
import { env } from '@config/env';
import { BadRequestError } from '@common/errors';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';

export const getNotificationSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await systemSettingService.getNotificationSettings();
  sendSuccess(res, settings);
});

export const updateNotificationSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await systemSettingService.updateNotificationSettings(req.body as UpdateNotificationSettingsDto, req.user!.id);
  sendSuccess(res, settings);
});

export const testNotification = asyncHandler(async (req: Request, res: Response) => {
  const { channel } = req.body as TestNotificationDto;
  await notificationService.sendTestNotification(channel, { id: req.user!.id, fullName: req.user!.fullName });
  sendSuccess(res, { sent: true });
});

export const getOrgSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await systemSettingService.getOrgSettings();
  sendSuccess(res, settings);
});

export const getBranding = asyncHandler(async (_req: Request, res: Response) => {
  const branding = await systemSettingService.getBranding();
  sendSuccess(res, branding);
});

export const updateOrgSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await systemSettingService.updateOrgSettings(req.body as UpdateOrgSettingsDto, req.user!.id);
  sendSuccess(res, settings);
});

export const uploadOrgLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('กรุณาแนบไฟล์โลโก้');
  const fileUrl = `${env.API_PREFIX}/files/logos/${req.file.filename}`;
  const settings = await systemSettingService.setOrgLogo(fileUrl, req.user!.id);
  sendSuccess(res, settings);
});

export const removeOrgLogo = asyncHandler(async (req: Request, res: Response) => {
  const settings = await systemSettingService.removeOrgLogo(req.user!.id);
  sendSuccess(res, settings);
});
