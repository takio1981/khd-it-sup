export interface IBackupTableGroup {
  group: string;
  labelTh: string;
  tables: string[];
}

export type BackupAction = 'BACKUP' | 'RESTORE';
export type BackupType = 'MANUAL' | 'AUTOMATIC' | 'SAFETY';
export type BackupScope = 'FULL' | 'PARTIAL';
export type BackupLogStatus = 'SUCCESS' | 'FAILED';

export interface IBackupLog {
  id: string;
  action: BackupAction;
  type: BackupType;
  scope: BackupScope;
  includedTables: string[] | null;
  sourceBackupLogId: string | null;
  fileName: string;
  fileSizeBytes: number | null;
  status: BackupLogStatus;
  triggeredBy: string | null;
  triggeredByUser: { id: string; fullName: string; username: string } | null;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface IBackupStatus {
  isRunning: boolean;
  currentOperation: 'BACKUP' | 'RESTORE' | null;
  startedAt: string | null;
  /** false เมื่อไม่พบ mariadb-dump/mariadb (หรือ mysqldump/mysql) บนเครื่องนี้ — ปกติเกิดเฉพาะตอน dev บน Windows host เท่านั้น */
  mariadbClientAvailable: boolean;
}

export interface IBackupSettings {
  enabled: boolean;
  scope: BackupScope;
  includedTables: string[];
  retentionDays: number;
}

export interface IUpdateBackupSettingsPayload {
  enabled?: boolean;
  scope?: BackupScope;
  includedTables?: string[];
  retentionDays?: number;
}

export interface IRunBackupPayload {
  scope: BackupScope;
  includedTables?: string[];
}

export interface IRestorePayload {
  confirmPassword: string;
  confirmFileName: string;
}
