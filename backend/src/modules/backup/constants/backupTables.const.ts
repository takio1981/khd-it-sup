/**
 * รายชื่อตารางทั้งหมดในระบบ จัดกลุ่มตามโมดูล — ใช้ 2 จุด:
 * 1) GET /backup/tables ให้ frontend render checkbox เป็นกลุ่ม (ไม่ใช่ list แบนราบ 38 รายการ)
 * 2) allowlist สำหรับ validate DTO (z.enum(ALL_BACKUP_TABLES)) ก่อนชื่อตารางจะถูกส่งต่อไปยัง mariadb-dump/mariadb
 *    เป็น defense-in-depth ชั้นแรกกันชื่อตารางแปลกปลอมหลุดเข้าไปถึงชั้น child_process (ดู mariadbCli.util.ts)
 */
export interface IBackupTableGroup {
  group: string;
  labelTh: string;
  tables: readonly string[];
}

export const BACKUP_TABLE_GROUPS: readonly IBackupTableGroup[] = [
  {
    group: 'auth',
    labelTh: 'สิทธิ์และการยืนยันตัวตน',
    tables: ['roles', 'permissions', 'role_permissions', 'refresh_tokens', 'password_reset_tokens', 'pin_credentials'],
  },
  { group: 'user_org', labelTh: 'ผู้ใช้/หน่วยงาน', tables: ['users', 'departments', 'positions', 'divisions'] },
  { group: 'location', labelTh: 'สถานที่', tables: ['buildings', 'floors', 'rooms'] },
  { group: 'vendor', labelTh: 'ผู้ขาย', tables: ['vendors'] },
  {
    group: 'asset',
    labelTh: 'ครุภัณฑ์',
    tables: ['asset_categories', 'assets', 'asset_loans', 'asset_loan_timeline', 'asset_photos', 'asset_qrcodes', 'qr_scan_logs'],
  },
  {
    group: 'workflow',
    labelTh: 'Workflow Engine',
    tables: ['workflow_templates', 'workflow_steps', 'workflow_transitions', 'workflow_instances'],
  },
  {
    group: 'ticket',
    labelTh: 'ใบแจ้งซ่อม',
    tables: ['repair_tickets', 'repair_ticket_attachments', 'repair_ticket_timeline', 'approvals'],
  },
  { group: 'spare_part', labelTh: 'อะไหล่', tables: ['spare_parts', 'spare_part_transactions'] },
  { group: 'vendor_repair', labelTh: 'ส่งซ่อมภายนอก', tables: ['vendor_repair_orders'] },
  { group: 'document', labelTh: 'เอกสารราชการ', tables: ['document_templates', 'generated_documents'] },
  { group: 'notification', labelTh: 'การแจ้งเตือน', tables: ['notification_logs'] },
  { group: 'system', labelTh: 'ระบบ', tables: ['system_settings', 'running_number_sequences'] },
  { group: 'audit_backup', labelTh: 'ตรวจสอบย้อนหลัง/สำรองข้อมูล', tables: ['audit_logs', 'backup_logs'] },
] as const;

export const ALL_BACKUP_TABLES: readonly string[] = BACKUP_TABLE_GROUPS.flatMap((g) => g.tables);
