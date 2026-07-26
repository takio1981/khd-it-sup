import type { Request, Response } from 'express';
import { systemSettingService } from '@modules/settings/services/systemSetting.service';
import type { UpdateNotificationSettingsDto } from '@modules/settings/dto/systemSetting.dto';
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
