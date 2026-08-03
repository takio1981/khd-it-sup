import { z } from 'zod';

export const generateDocumentSchema = z.object({
  templateCode: z.string().min(1, 'กรุณาระบุ templateCode'),
  ticketId: z.string().uuid().optional(),
});
export type GenerateDocumentDto = z.infer<typeof generateDocumentSchema>;

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  ticketId: z.string().uuid().optional(),
  templateCode: z.string().optional(),
});
export type ListDocumentsQueryDto = z.infer<typeof listDocumentsQuerySchema>;

export const exportDocumentsQuerySchema = z.object({
  ticketId: z.string().uuid().optional(),
  templateCode: z.string().optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});
export type ExportDocumentsQueryDto = z.infer<typeof exportDocumentsQuerySchema>;
