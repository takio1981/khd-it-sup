import type { Request, Response } from 'express';
import { backupService } from '@modules/backup/services/backup.service';
import { BACKUP_TABLE_GROUPS } from '@modules/backup/constants/backupTables.const';
import type {
  BackupIdParamsDto,
  ListBackupLogsQueryDto,
  RestoreDto,
  RunBackupDto,
  UpdateBackupSettingsDto,
} from '@modules/backup/dto/backup.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const getTables = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, BACKUP_TABLE_GROUPS);
});

export const getStatus = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await backupService.getStatus());
});

export const listBackupLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await backupService.list(req.query as unknown as ListBackupLogsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const runBackup = asyncHandler(async (req: Request, res: Response) => {
  const result = await backupService.runManual(req.body as RunBackupDto, contextOf(req));
  sendSuccess(res, result, 202);
});

export const downloadBackup = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as BackupIdParamsDto;
  const { filePath, fileName } = await backupService.getDownloadTarget(id);
  res.download(filePath, fileName);
});

export const deleteBackup = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as BackupIdParamsDto;
  await backupService.deleteBackup(id, contextOf(req));
  sendSuccess(res, { message: 'ลบไฟล์สำรองข้อมูลสำเร็จ' });
});

export const restoreBackup = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as BackupIdParamsDto;
  const result = await backupService.restore(id, req.body as RestoreDto, contextOf(req));
  sendSuccess(res, result, 202);
});

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await backupService.getSettings());
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const result = await backupService.updateSettings(req.body as UpdateBackupSettingsDto, req.user!.id);
  sendSuccess(res, result);
});
