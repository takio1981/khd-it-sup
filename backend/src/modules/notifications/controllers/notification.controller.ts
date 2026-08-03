import type { Request, Response } from 'express';
import { notificationService } from '@modules/notifications/services/notification.service';
import type {
  ExportNotificationLogsQueryDto,
  ListMyNotificationsQueryDto,
  ListNotificationLogsQueryDto,
} from '@modules/notifications/dto/notification.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';

const CHANNEL_LABEL_TH: Record<string, string> = { EMAIL: 'อีเมล', TELEGRAM: 'Telegram', LINE: 'LINE', PUSH: 'Push', SMS: 'SMS' };
const STATUS_LABEL_TH: Record<string, string> = { PENDING: 'รอดำเนินการ', SENT: 'ส่งสำเร็จ', FAILED: 'ส่งไม่สำเร็จ', READ: 'อ่านแล้ว' };

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'ช่องทาง', key: 'channelTh', width: 14 },
  { header: 'ผู้รับ', key: 'recipient', width: 26 },
  { header: 'หัวข้อ', key: 'subject', width: 30 },
  { header: 'สถานะ', key: 'statusTh', width: 14 },
  { header: 'วันที่ส่ง', key: 'sentAt', width: 18 },
  { header: 'ข้อผิดพลาด', key: 'errorMessage', width: 30 },
  { header: 'วันที่สร้าง', key: 'createdAt', width: 18 },
];

function formatDateTh(date: Date | string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export const listNotificationLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationService.listLogs(req.query as unknown as ListNotificationLogsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const exportNotificationLogs = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportNotificationLogsQueryDto;
  const items = await notificationService.listLogsForExport({ channel: query.channel, status: query.status });

  const rows = items.map((n) => ({
    channelTh: CHANNEL_LABEL_TH[n.channel] ?? n.channel,
    recipient: n.recipient,
    subject: n.subject ?? '',
    statusTh: STATUS_LABEL_TH[n.status] ?? n.status,
    sentAt: formatDateTh(n.sentAt),
    errorMessage: n.errorMessage ?? '',
    createdAt: formatDateTh(n.createdAt),
  }));

  const filenameBase = `notification-logs-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Notification Logs', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
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
