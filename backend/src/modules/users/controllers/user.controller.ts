import type { Request, Response } from 'express';
import { UserService } from '@modules/users/services/user.service';
import type { CreateUserDto, ExportUsersQueryDto, ListUsersQueryDto, UpdateUserDto } from '@modules/users/dto/user.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import { buildCsv, buildExcelBuffer, type IExportColumn } from '@common/utils/export.util';
import type { IRequestContext } from '@common/interfaces';

const userService = new UserService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

const EXPORT_COLUMNS: IExportColumn[] = [
  { header: 'ชื่อ-นามสกุล', key: 'fullName', width: 24 },
  { header: 'Username', key: 'username', width: 18 },
  { header: 'อีเมล', key: 'email', width: 26 },
  { header: 'เบอร์โทร', key: 'phone', width: 16 },
  { header: 'สิทธิ์', key: 'roleTh', width: 18 },
  { header: 'หน่วยงาน', key: 'departmentTh', width: 22 },
  { header: 'ตำแหน่ง', key: 'positionTh', width: 20 },
  { header: 'สถานะ', key: 'statusTh', width: 12 },
  { header: 'วันที่สร้าง', key: 'createdAt', width: 18 },
];

function formatDateTh(date: Date | string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await userService.listRoles();
  sendSuccess(res, roles);
});

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await userService.getStats();
  sendSuccess(res, stats);
});

export const listTechnicians = asyncHandler(async (_req: Request, res: Response) => {
  const technicians = await userService.listTechnicians();
  sendSuccess(res, technicians);
});

export const listTechnicianWorkload = asyncHandler(async (_req: Request, res: Response) => {
  const workload = await userService.listTechnicianWorkload();
  sendSuccess(res, workload);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.list(req.query as unknown as ListUsersQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
});

export const exportUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ExportUsersQueryDto;
  const items = await userService.listForExport({ roleId: query.roleId, departmentId: query.departmentId, keyword: query.keyword });

  const rows = items.map((u) => ({
    fullName: u.fullName,
    username: u.username,
    email: u.email,
    phone: u.phone ?? '',
    roleTh: u.role?.nameTh ?? '',
    departmentTh: u.department?.nameTh ?? '',
    positionTh: u.position?.nameTh ?? '',
    statusTh: u.isActive ? 'ใช้งาน' : 'ระงับ',
    createdAt: formatDateTh(u.createdAt),
  }));

  const filenameBase = `users-${Date.now()}`;
  if (query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(buildCsv(EXPORT_COLUMNS, rows));
  } else {
    const buffer = await buildExcelBuffer('Users', EXPORT_COLUMNS, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
  }
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getById(req.params.id);
  sendSuccess(res, user);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.create(req.body as CreateUserDto, contextOf(req));
  sendCreated(res, user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.update(req.params.id, req.body as UpdateUserDto, contextOf(req));
  sendSuccess(res, user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.remove(req.params.id, contextOf(req));
  sendSuccess(res, { message: 'ลบผู้ใช้สำเร็จ' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.resetPassword(req.params.id, contextOf(req));
  sendSuccess(res, result);
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw new BadRequestError('กรุณาแนบไฟล์รูปภาพ');
  const user = await userService.setAvatar(req.params.id, file, contextOf(req));
  sendSuccess(res, user);
});

export const removeAvatar = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.removeAvatar(req.params.id, contextOf(req));
  sendSuccess(res, user);
});
