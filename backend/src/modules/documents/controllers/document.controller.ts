import type { Request, Response } from 'express';
import { documentService } from '@modules/documents/services/document.service';
import type { ExportDocumentsQueryDto, GenerateDocumentDto, ListDocumentsQueryDto } from '@modules/documents/dto/document.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';
import { env } from '@config/env';
import type { IRequestContext } from '@common/interfaces';

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listTemplates = asyncHandler(async (_req: Request, res: Response) => {
  const templates = await documentService.listTemplates();
  sendSuccess(res, templates);
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const result = await documentService.list(req.query as unknown as ListDocumentsQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'เลขที่เอกสาร', key: 'runningNumber', width: 20 },
  { header: 'แบบฟอร์ม', key: 'templateCode', width: 20 },
  { header: 'ใบแจ้งซ่อมที่เกี่ยวข้อง', key: 'ticketNumber', width: 20 },
  { header: 'วันที่ออกเอกสาร', key: 'generatedAt', width: 18 },
];

function formatDateTh(date: Date | string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export const exportDocuments = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportDocumentsQueryDto;
  const items = await documentService.listForExport({ ticketId: query.ticketId, templateCode: query.templateCode });

  const rows = items.map((d) => ({
    runningNumber: d.runningNumber,
    templateCode: d.templateCode,
    ticketNumber: d.ticket?.ticketNumber ?? '',
    generatedAt: formatDateTh(d.generatedAt),
  }));

  const filenameBase = `documents-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Documents', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
});

export const generateDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('กรุณาแนบไฟล์เอกสารที่ render แล้ว (field "file")');
  const fileUrl = `${env.API_PREFIX}/files/documents/${req.file.filename}`;
  const doc = await documentService.generate(req.body as GenerateDocumentDto, fileUrl, contextOf(req));
  sendCreated(res, doc);
});
