export type RoleCode = 'SUPER_ADMIN' | 'ADMIN' | 'IT_OFFICER' | 'TECHNICIAN' | 'USER';

export type Gender = 'MALE' | 'FEMALE';

/** ต้องตรงกับ backend/src/common/constants/permissions.const.ts เสมอ (source of truth คือฝั่ง backend) */
export type Permission =
  | 'dashboard:view'
  | 'asset:create'
  | 'asset:read'
  | 'asset:update'
  | 'asset:delete'
  | 'asset:view_history'
  | 'asset:loan'
  | 'qrcode:generate'
  | 'qrcode:print'
  | 'ticket:create'
  | 'ticket:read'
  | 'ticket:track'
  | 'ticket:receive'
  | 'ticket:assign'
  | 'ticket:update_status'
  | 'ticket:upload_attachment'
  | 'ticket:cancel'
  | 'ticket:close'
  | 'ticket:accept'
  | 'ticket:approve'
  | 'ticket:approve_unit_head'
  | 'user:create'
  | 'user:read'
  | 'user:update'
  | 'user:delete'
  | 'user:reset_password'
  | 'department:manage'
  | 'report:view'
  | 'report:export'
  | 'settings:manage'
  | 'audit:view'
  | 'workflow:configure'
  | 'document:print'
  | 'document:generate'
  | 'spare_part:view'
  | 'spare_part:manage'
  | 'spare_part:issue'
  | 'vendor:view'
  | 'vendor:manage';

export interface IAuthUser {
  id: string;
  username: string;
  fullName: string;
  role: RoleCode;
  permissions: Permission[];
  departmentId: string | null;
  mustChangePassword: boolean;
  avatarUrl: string | null;
  gender: Gender | null;
  isUnitHead: boolean;
}

export interface ILoginRequest {
  username: string;
  password: string;
}

export interface ILoginResponse {
  accessToken: string;
  user: IAuthUser;
}

export interface INotificationChannels {
  telegramChatId: string | null;
  lineUserId: string | null;
}

export interface IUpdateNotificationChannelsPayload {
  telegramChatId?: string | null;
  lineUserId?: string | null;
}

export interface IPinSetupRequest {
  password: string;
  pin: string;
}

export interface IPinSetupResponse {
  deviceLabel: string | null;
  expiresAt: string;
}

/** ผลตรวจสอบว่าอุปกรณ์นี้มี PIN ที่ใช้งานได้อยู่หรือไม่ — แหล่งความจริงที่แท้จริง ไม่ใช่ localStorage marker */
export interface IPinStatusResponse {
  available: boolean;
  /** เคยตั้งค่า PIN บนเครื่องนี้มาก่อน (แม้ตอนนี้จะถูกยกเลิก/หมดอายุ) — เปิดใช้งานใหม่ได้โดยไม่ต้องตั้ง PIN ใหม่ */
  hasHistory: boolean;
  username?: string;
  fullName?: string;
  gender?: Gender | null;
}

export interface IPinLoginRequest {
  pin: string;
}

export interface IPinDevice {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  isCurrentDevice: boolean;
}

/** เก็บใน localStorage เท่านั้น — ไม่มี PIN/token/secret ใดๆ ใช้แค่บอกว่าเบราว์เซอร์นี้ควรแสดงหน้า PIN หรือหน้ารหัสผ่าน */
export interface IPinLoginMarker {
  username: string;
  fullName: string;
  gender: Gender | null;
}
