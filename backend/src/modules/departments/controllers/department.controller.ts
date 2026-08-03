import type { Request, Response } from 'express';
import { DepartmentService } from '@modules/departments/services/department.service';
import type { CreateDepartmentDto, ExportDepartmentsQueryDto, UpdateDepartmentDto } from '@modules/departments/dto/department.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';
import type { IRequestContext } from '@common/interfaces';

const departmentService = new DepartmentService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'รหัส', key: 'code', width: 14 },
  { header: 'ชื่อหน่วยงาน', key: 'nameTh', width: 30 },
  { header: 'ชื่อภาษาอังกฤษ', key: 'nameEn', width: 26 },
  { header: 'หน่วยงานแม่', key: 'parentTh', width: 26 },
];

export const listDepartments = asyncHandler(async (_req: Request, res: Response) => {
  const departments = await departmentService.list();
  sendSuccess(res, departments);
});

export const exportDepartments = asyncHandler(async (req: Request, res: Response) => {
  const { format } = req.query as unknown as ExportDepartmentsQueryDto;
  const departments = await departmentService.list();
  const nameById = new Map(departments.map((d) => [d.id, d.nameTh]));

  const rows = departments.map((d) => ({
    code: d.code,
    nameTh: d.nameTh,
    nameEn: d.nameEn ?? '',
    parentTh: d.parentId ? (nameById.get(d.parentId) ?? '') : '',
  }));

  const filenameBase = `departments-${Date.now()}`;
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Departments', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
});

export const getDepartment = asyncHandler(async (req: Request, res: Response) => {
  const dept = await departmentService.getById(req.params.id);
  sendSuccess(res, dept);
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const dept = await departmentService.create(req.body as CreateDepartmentDto, contextOf(req));
  sendCreated(res, dept);
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const dept = await departmentService.update(req.params.id, req.body as UpdateDepartmentDto, contextOf(req));
  sendSuccess(res, dept);
});

export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  await departmentService.remove(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ปิดใช้งานหน่วยงานสำเร็จ' });
});
