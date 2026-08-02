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
  | 'ticket:approve'
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
  | 'spare_part:issue';

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
