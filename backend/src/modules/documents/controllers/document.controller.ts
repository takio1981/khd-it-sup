import type { Request, Response } from 'express';
import { documentService } from '@modules/documents/services/document.service';
import type { GenerateDocumentDto, ListDocumentsQueryDto } from '@modules/documents/dto/document.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
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

export const generateDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new BadRequestError('กรุณาแนบไฟล์เอกสารที่ render แล้ว (field "file")');
  const fileUrl = `${env.API_PREFIX}/files/documents/${req.file.filename}`;
  const doc = await documentService.generate(req.body as GenerateDocumentDto, fileUrl, contextOf(req));
  sendCreated(res, doc);
});
