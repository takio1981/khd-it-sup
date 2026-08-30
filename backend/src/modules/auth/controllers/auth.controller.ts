import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from '@modules/auth/services/auth.service';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  PinLoginDto,
  PinSetupDto,
  ResetPasswordDto,
  UpdateNotificationChannelsDto,
  UpdateProfileDto,
} from '@modules/auth/dto/auth.dto';
import { asyncHandler } from '@common/utils/asyncHandler';
import { sendSuccess } from '@common/utils/apiResponse';
import { BadRequestError, UnauthorizedError } from '@common/errors';
import { env } from '@config/env';
import { auditLogService } from '@modules/audit-log/services/auditLog.service';

const authService = new AuthService();

/**
 * เส้นทางจริงที่ browser เห็น (ผ่าน reverse proxy) อาจมี path prefix เพิ่มจาก FRONTEND_BASE_URL
 * (เช่น "/khd-it-sup") ซึ่ง backend เองไม่รู้จัก — ต้องรวม prefix นี้เข้ากับ path ของ cookie เสมอ
 * ไม่งั้น browser จะไม่แนบ cookie กลับมาให้ตอนเรียก /refresh เพราะ path ไม่ตรงกับ request จริง
 */
function externalPathPrefix(): string {
  try {
    return new URL(env.FRONTEND_BASE_URL).pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * ใช้ `req.secure` (อ่านจาก X-Forwarded-Proto ผ่าน `app.set('trust proxy', 1)`) แทนการอิง
 * isProduction ตรงๆ — deployment นี้เสิร์ฟผ่าน HTTP ล้วน (ไม่มี TLS ที่ Nginx) แม้ใน production ถ้าตั้ง
 * secure:true ทื่อๆ ตาม NODE_ENV บราวเซอร์จะไม่ยอมเก็บ cookie เลยเวลาเข้าผ่าน IP เครื่อง (เช่นจากมือถือ) —
 * มีแค่ localhost/127.0.0.1 ที่บราวเซอร์บางตัวยกเว้นให้ ถ้าวันไหนใส่ TLS จริงที่ Nginx ค่านี้จะเป็น true เองอัตโนมัติ
 */
function refreshCookieOptions(req: Request, expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict',
    path: `${externalPathPrefix()}${env.API_PREFIX}/auth`,
    expires: expiresAt,
  };
}

function pinDeviceCookiePath(): string {
  return `${externalPathPrefix()}${env.API_PREFIX}/auth/pin`;
}

function pinDeviceCookieOptions(req: Request, expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict',
    path: pinDeviceCookiePath(),
    expires: expiresAt,
  };
}

function getContext(req: Request) {
  return { ipAddress: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? 'unknown' };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as LoginDto;
  const result = await authService.login(username, password, getContext(req));

  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshCookieOptions(req, result.refreshTokenExpiresAt));
  sendSuccess(res, { accessToken: result.accessToken, user: result.user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
  if (!token) {
    throw new UnauthorizedError('ไม่พบ Refresh Token กรุณาเข้าสู่ระบบใหม่');
  }

  const result = await authService.refresh(token, getContext(req));
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshCookieOptions(req, result.refreshTokenExpiresAt));
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
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, { path: `${externalPathPrefix()}${env.API_PREFIX}/auth` });
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

export const getNotificationChannels = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await authService.getNotificationChannels(req.user!.id));
});

export const updateNotificationChannels = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.updateNotificationChannels(req.user!.id, req.body as UpdateNotificationChannelsDto);
  sendSuccess(res, result);
});

export const uploadMyAvatar = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw new BadRequestError('กรุณาแนบไฟล์รูปภาพ');
  const user = await authService.setMyAvatar(req.user!.id, file);
  sendSuccess(res, user);
});

export const removeMyAvatar = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.removeMyAvatar(req.user!.id);
  sendSuccess(res, user);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { gender } = req.body as UpdateProfileDto;
  const user = await authService.updateMyGender(req.user!.id, gender);
  sendSuccess(res, user);
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { usernameOrEmail } = req.body as ForgotPasswordDto;
  await authService.forgotPassword(usernameOrEmail);
  sendSuccess(res, { message: 'หากมีบัญชีนี้อยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลที่ลงทะเบียนไว้แล้ว' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body as ResetPasswordDto;
  await authService.resetPassword(token, newPassword);
  sendSuccess(res, { message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' });
});

export const setupPin = asyncHandler(async (req: Request, res: Response) => {
  const existingDeviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;
  const result = await authService.setupPin(
    req.user!.id,
    req.body as PinSetupDto,
    getContext(req),
    req.headers['user-agent'] ?? '',
    existingDeviceSecret,
  );

  res.cookie(env.PIN_DEVICE_COOKIE_NAME, result.deviceSecret, pinDeviceCookieOptions(req, result.expiresAt));
  sendSuccess(res, { deviceLabel: result.deviceLabel, expiresAt: result.expiresAt });
});

export const pinStatus = asyncHandler(async (req: Request, res: Response) => {
  const deviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;
  const result = await authService.getPinDeviceStatus(deviceSecret);
  sendSuccess(res, result);
});

export const myPinStatus = asyncHandler(async (req: Request, res: Response) => {
  const deviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;
  const result = await authService.getPinDeviceStatusForUser(req.user!.id, deviceSecret);
  sendSuccess(res, result);
});

export const pinLogin = asyncHandler(async (req: Request, res: Response) => {
  const deviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;

  try {
    const result = await authService.loginWithPin(deviceSecret, req.body as PinLoginDto, getContext(req));
    res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshCookieOptions(req, result.refreshTokenExpiresAt));
    res.cookie(env.PIN_DEVICE_COOKIE_NAME, result.deviceSecret, pinDeviceCookieOptions(req, result.deviceExpiresAt));
    sendSuccess(res, { accessToken: result.accessToken, user: result.user });
  } catch (err) {
    // อุปกรณ์นี้ใช้ PIN ต่อไม่ได้แล้ว (ถูกยกเลิก/หมดอายุ/ไม่รู้จัก) — ล้าง cookie ทิ้งเพื่อไม่ให้ frontend ยังพยายามแสดงหน้า PIN ต่อ
    if (
      err instanceof UnauthorizedError &&
      ['PIN_REVOKED', 'PIN_EXPIRED', 'PIN_DEVICE_UNKNOWN'].includes(err.code)
    ) {
      res.clearCookie(env.PIN_DEVICE_COOKIE_NAME, { path: pinDeviceCookiePath() });
    }
    throw err;
  }
});

export const listPinDevices = asyncHandler(async (req: Request, res: Response) => {
  const currentDeviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;
  const devices = await authService.listPinDevices(req.user!.id, currentDeviceSecret);
  sendSuccess(res, devices);
});

export const revokePinDevice = asyncHandler(async (req: Request, res: Response) => {
  const currentDeviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;
  const { wasCurrentDevice } = await authService.revokePinDevice(req.user!.id, req.params.id, currentDeviceSecret);

  if (wasCurrentDevice) {
    res.clearCookie(env.PIN_DEVICE_COOKIE_NAME, { path: pinDeviceCookiePath() });
  }
  sendSuccess(res, { message: 'ยกเลิกอุปกรณ์นี้เรียบร้อยแล้ว' });
});

export const disablePin = asyncHandler(async (req: Request, res: Response) => {
  await authService.disablePin(req.user!.id);
  res.clearCookie(env.PIN_DEVICE_COOKIE_NAME, { path: pinDeviceCookiePath() });
  sendSuccess(res, { message: 'ปิดใช้งาน PIN ทุกอุปกรณ์เรียบร้อยแล้ว' });
});

export const revokeCurrentPinDevice = asyncHandler(async (req: Request, res: Response) => {
  const deviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;
  await authService.revokeCurrentPinDevice(req.user!.id, deviceSecret);
  // ตั้งใจไม่ล้าง cookie ตรงนี้ (ต่างจาก disablePin/revokePinDevice) — เก็บไว้ให้สลับสวิตช์เปิดกลับมาใช้ PIN
  // เดิมได้ทันทีผ่าน /pin/reactivate-current โดยไม่ต้องตั้ง PIN ใหม่ cookie ที่ค้างไว้นี้ใช้ login ไม่ได้อยู่แล้ว
  // (แถวถูก revoke) จนกว่าเจ้าของบัญชีจะ login ด้วยรหัสผ่านแล้วกดเปิดใช้งาน PIN ซ้ำเองเท่านั้น
  sendSuccess(res, { message: 'ปิดใช้งาน PIN สำหรับเครื่องนี้เรียบร้อยแล้ว' });
});

export const reactivateCurrentPinDevice = asyncHandler(async (req: Request, res: Response) => {
  const deviceSecret = req.cookies?.[env.PIN_DEVICE_COOKIE_NAME] as string | undefined;
  await authService.reactivateCurrentPinDevice(req.user!.id, deviceSecret);
  sendSuccess(res, { message: 'เปิดใช้งาน PIN สำหรับเครื่องนี้อีกครั้งเรียบร้อยแล้ว' });
});
