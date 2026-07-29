import type { Request, Response } from 'express';
import { UserService } from '@modules/users/services/user.service';
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from '@modules/users/dto/user.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendCreated, sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError } from '@common/errors';
import type { IRequestContext } from '@common/interfaces';

const userService = new UserService();

function contextOf(req: Request): IRequestContext {
  return { user: req.user!, ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
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

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.list(req.query as unknown as ListUsersQueryDto);
  sendSuccess(res, result.items, 200, result.meta);
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
