import type { Request, Response } from 'express';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { ListAuditLogsQueryDto } from '@modules/audit-log/dto/auditLog.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditLogService.list(req.query as unknown as ListAuditLogsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});
