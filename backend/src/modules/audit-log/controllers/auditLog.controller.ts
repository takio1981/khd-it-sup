import type { Request, Response } from 'express';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';
import type { ExportAuditLogsQueryDto, ListAuditLogsQueryDto } from '@modules/audit-log/dto/auditLog.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';

const ACTION_LABEL_TH: Record<string, string> = {
  LOGIN: 'เข้าสู่ระบบ',
  LOGOUT: 'ออกจากระบบ',
  CREATE: 'สร้างใหม่',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
  PRINT: 'พิมพ์เอกสาร',
  EXPORT: 'ส่งออกข้อมูล',
  APPROVE: 'อนุมัติ',
  CONFIG_CHANGE: 'เปลี่ยนแปลงการตั้งค่า',
};

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'เวลา', key: 'createdAt', width: 18 },
  { header: 'ผู้ใช้', key: 'userTh', width: 20 },
  { header: 'การกระทำ', key: 'actionTh', width: 16 },
  { header: 'โมดูล', key: 'module', width: 18 },
  { header: 'ประเภท', key: 'entityType', width: 18 },
  { header: 'รายละเอียด', key: 'description', width: 36 },
  { header: 'IP', key: 'ipAddress', width: 16 },
];

function formatDateTh(date: Date | string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditLogService.list(req.query as unknown as ListAuditLogsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const exportAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportAuditLogsQueryDto;
  const items = await auditLogService.listForExport(query);

  const rows = items.map((l) => ({
    createdAt: formatDateTh(l.createdAt),
    userTh: l.user?.fullName ?? '',
    actionTh: ACTION_LABEL_TH[l.action] ?? l.action,
    module: l.module,
    entityType: l.entityType ?? '',
    description: l.description ?? '',
    ipAddress: l.ipAddress ?? '',
  }));

  const filenameBase = `audit-logs-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Audit Logs', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
});
