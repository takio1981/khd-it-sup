import type { Request, Response } from 'express';
import { DepartmentService } from '@modules/departments/services/department.service';
import type { CreateDepartmentDto, UpdateDepartmentDto } from '@modules/departments/dto/department.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import type { IRequestContext } from '@common/interfaces';

const departmentService = new DepartmentService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const listDepartments = asyncHandler(async (_req: Request, res: Response) => {
  const departments = await departmentService.list();
  sendSuccess(res, departments);
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
