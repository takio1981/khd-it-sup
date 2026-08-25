import { z } from 'zod';

export const createAssetLoanSchema = z.object({
  assetId: z.string().uuid('assetId ต้องเป็น UUID'),
  borrowerId: z.string().uuid('borrowerId ต้องเป็น UUID'),
  expectedReturnDate: z.coerce.date().optional(),
  purpose: z.string().max(500).optional(),
  conditionOnBorrow: z.string().max(500).optional(),
});
export type CreateAssetLoanDto = z.infer<typeof createAssetLoanSchema>;

export const updateAssetLoanSchema = createAssetLoanSchema.partial().extend({
  conditionOnReturn: z.string().max(500).optional(),
});
export type UpdateAssetLoanDto = z.infer<typeof updateAssetLoanSchema>;

export const returnAssetLoanSchema = z.object({
  conditionOnReturn: z.string().max(500).optional(),
});
export type ReturnAssetLoanDto = z.infer<typeof returnAssetLoanSchema>;

export const listAssetLoansQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.enum(['BORROWED', 'OVERDUE', 'RETURNED']).optional(),
  assetId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListAssetLoansQueryDto = z.infer<typeof listAssetLoansQuerySchema>;

export const exportAssetLoansQuerySchema = z.object({
  status: z.enum(['BORROWED', 'OVERDUE', 'RETURNED']).optional(),
  assetId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});
export type ExportAssetLoansQueryDto = z.infer<typeof exportAssetLoansQuerySchema>;

export const assetLoanDepartmentReportQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  status: z.enum(['BORROWED', 'OVERDUE', 'RETURNED']).optional(),
  assetId: z.string().uuid().optional(),
});
export type AssetLoanDepartmentReportQueryDto = z.infer<typeof assetLoanDepartmentReportQuerySchema>;

export const assetLoanIdParamSchema = z.object({ id: z.string().uuid('id ต้องเป็น UUID') });
