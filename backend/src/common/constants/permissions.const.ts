/**
 * Permission codes — ต้องตรงกับ `permissions.code` ใน database/seed.sql เสมอ (single source of truth)
 * ใช้ enum-like const object แทน TypeScript enum เพื่อให้ tree-shake ได้ดีกว่าและใช้เป็น string literal type ตรง ๆ
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',

  ASSET_CREATE: 'asset:create',
  ASSET_READ: 'asset:read',
  ASSET_UPDATE: 'asset:update',
  ASSET_DELETE: 'asset:delete',
  ASSET_VIEW_HISTORY: 'asset:view_history',
  ASSET_LOAN: 'asset:loan',

  QRCODE_GENERATE: 'qrcode:generate',
  QRCODE_PRINT: 'qrcode:print',

  TICKET_CREATE: 'ticket:create',
  TICKET_READ: 'ticket:read',
  TICKET_TRACK: 'ticket:track',
  TICKET_RECEIVE: 'ticket:receive',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_UPDATE_STATUS: 'ticket:update_status',
  TICKET_UPLOAD_ATTACHMENT: 'ticket:upload_attachment',
  TICKET_CANCEL: 'ticket:cancel',
  TICKET_CLOSE: 'ticket:close',

  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_RESET_PASSWORD: 'user:reset_password',

  DEPARTMENT_MANAGE: 'department:manage',

  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_VIEW: 'audit:view',
  WORKFLOW_CONFIGURE: 'workflow:configure',

  DOCUMENT_PRINT: 'document:print',
  DOCUMENT_GENERATE: 'document:generate',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
