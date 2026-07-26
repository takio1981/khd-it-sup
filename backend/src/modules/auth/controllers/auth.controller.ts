import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from '@modules/auth/services/auth.service';
import type { ChangePasswordDto, LoginDto } from '@modules/auth/dto/auth.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import { UnauthorizedError } from '@common/errors';
import { env, isProduction } from '@config/env';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';

const authService = new AuthService();

function refreshCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: `${env.API_PREFIX}/auth`,
    expires: expiresAt,
  };
}

function getContext(req: Request) {
  return { ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as LoginDto;
  const result = await authService.login(username, password, getContext(req));

  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
  sendSuccess(res, { accessToken: result.accessToken, user: result.user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
  if (!token) {
    throw new UnauthorizedError('ไม่พบ Refresh Token กรุณาเข้าสู่ระบบใหม่');
  }

  const result = await authService.refresh(token, getContext(req));
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
  sendSuccess(res, { accessToken: result.accessToken, user: result.user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
  if (token) {
    await authService.logout(token);
  }
  if (req.user) {
    await auditLogService.record(
      { action: 'LOGOUT', module: 'auth', entityType: 'User', entityId: req.user.id, description: `${req.user.username} ออกจากระบบ` },
      { user: req.user, ...getContext(req) },
    );
  }
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, { path: `${env.API_PREFIX}/auth` });
  sendSuccess(res, { message: 'ออกจากระบบสำเร็จ' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, req.user);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordDto;
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  sendSuccess(res, { message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
});
