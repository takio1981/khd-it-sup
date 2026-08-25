import type { Request, Response } from 'express';
import { AssetLoanService } from '@modules/asset-loans/services/assetLoan.service';
import type {
  AssetLoanDepartmentReportQueryDto,
  CreateAssetLoanDto,
  ExportAssetLoansQueryDto,
  ListAssetLoansQueryDto,
  ReturnAssetLoanDto,
  UpdateAssetLoanDto,
} from '@modules/asset-loans/dto/assetLoan.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';
import type { IRequestContext } from '@common/interfaces';

const assetLoanService = new AssetLoanService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

const STATUS_LABEL_TH: Record<string, string> = { BORROWED: 'กำลังยืม', OVERDUE: 'เกินกำหนด', RETURNED: 'คืนแล้ว' };

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'ครุภัณฑ์', key: 'assetNumber', width: 18 },
  { header: 'ยี่ห้อ/รุ่น', key: 'assetModel', width: 22 },
  { header: 'หมวดหมู่', key: 'category', width: 20 },
  { header: 'ผู้ยืม', key: 'borrower', width: 20 },
  { header: 'วันที่ยืม', key: 'borrowDate', width: 18 },
  { header: 'กำหนดคืน', key: 'expectedReturnDate', width: 18 },
  { header: 'วันที่คืนจริง', key: 'actualReturnDate', width: 18 },
  { header: 'สถานะ', key: 'statusTh', width: 14 },
  { header: 'ผู้บันทึก', key: 'recordedBy', width: 18 },
  { header: 'ผู้รับคืน', key: 'returnedBy', width: 18 },
  { header: 'วัตถุประสงค์', key: 'purpose', width: 26 },
];

function formatDateTh(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export const listAssetLoans = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListAssetLoansQueryDto;
  const result = await assetLoanService.list(query);
  sendSuccess(res, result.items, 200, result.meta);
});

export const exportAssetLoans = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportAssetLoansQueryDto;
  const items = await assetLoanService.listForExport({
    status: query.status,
    keyword: query.keyword,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  const rows = items.map((l) => ({
    assetNumber: l.asset.assetNumber,
    assetModel: [l.asset.brand, l.asset.model].filter(Boolean).join(' '),
    category: l.asset.category?.nameTh ?? '',
    borrower: l.borrower.fullName,
    borrowDate: formatDateTh(l.borrowDate),
    expectedReturnDate: formatDateTh(l.expectedReturnDate),
    actualReturnDate: formatDateTh(l.actualReturnDate),
    statusTh: STATUS_LABEL_TH[l.status] ?? l.status,
    recordedBy: l.recorder?.fullName ?? '',
    returnedBy: l.returner?.fullName ?? '',
    purpose: l.purpose ?? '',
  }));

  const filenameBase = `asset-loans-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Asset Loans', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
});

export const getAssetLoanStats = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await assetLoanService.getStats());
});

export const getAssetLoanChartData = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await assetLoanService.getChartData());
});

export const getAssetLoanDepartmentReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as AssetLoanDepartmentReportQueryDto;
  const report = await assetLoanService.getDepartmentBreakdown({
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });
  sendSuccess(res, report);
});

export const getAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await assetLoanService.getById(req.params.id));
});

export const createAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.create(req.body as CreateAssetLoanDto, contextOf(req));
  sendCreated(res, loan);
});

export const updateAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.update(req.params.id, req.body as UpdateAssetLoanDto, contextOf(req));
  sendSuccess(res, loan);
});

export const deleteAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  await assetLoanService.remove(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ลบรายการยืมสำเร็จ' });
});

export const returnAssetLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await assetLoanService.returnLoan(req.params.id, req.body as ReturnAssetLoanDto, contextOf(req));
  sendSuccess(res, loan);
});
