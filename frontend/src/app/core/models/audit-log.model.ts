export type AuditLogAction = 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'PRINT' | 'EXPORT' | 'APPROVE' | 'CONFIG_CHANGE';

export interface IAuditLog {
  id: string;
  userId: string | null;
  user: { id: string; fullName: string; username: string } | null;
  action: AuditLogAction;
  module: string;
  entityType: string | null;
  entityId: string | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
