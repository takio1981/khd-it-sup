/** ต้องตรงกับ backend/src/common/constants/statusColor.const.ts เสมอ
 * หมายเหตุ workflow v2 (2026-09-17): รวม RECEIVED+IT_REVIEW+DIAGNOSIS เป็น RECEIVED เดียว,
 * REPAIRING+TESTING เป็น TESTING เดียว, COMPLETED+RETURNED เป็น COMPLETED เดียว — คง entry เดิมของ
 * IT_REVIEW/DIAGNOSIS/REPAIRING/RETURNED ไว้ในนี้ (ไม่ลบ) เพราะใบแจ้งซ่อมเก่าที่ยังค้างอยู่ใน v1
 * (workflow_templates.version=1, is_active=0) และ Timeline ประวัติของใบที่ปิดไปแล้วยังอ้าง step_code
 * เหล่านี้อยู่ ต้องมีสี/label ให้ render ถูกต้อง แม้จะไม่ใช่ step ที่ใบใหม่จะไปถึงอีกแล้วก็ตาม */
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9CA3AF',
  SUBMITTED: '#3B82F6',
  RECEIVED: '#6366F1',
  IT_REVIEW: '#6366F1',
  DIAGNOSIS: '#8B5CF6',
  WAITING_APPROVAL: '#F97316',
  WAITING_PARTS: '#F59E0B',
  REPAIRING: '#06B6D4',
  TESTING: '#06B6D4',
  VENDOR_REPAIR: '#F97316',
  COMPLETED: '#22C55E',
  RETURNED: '#14B8A6',
  USER_ACCEPTANCE: '#14B8A6',
  CLOSED: '#166534',
  CANCELLED: '#EF4444',
  REJECTED: '#991B1B',

  // สถานะครุภัณฑ์ (AssetStatus) — WAITING_PARTS ใช้ร่วมกับสถานะงานแจ้งซ่อมด้านบน
  ACTIVE: '#22C55E',
  IN_REPAIR: '#06B6D4',
  MAINTENANCE: '#8B5CF6',
  RESERVED: '#3B82F6',
  INACTIVE: '#9CA3AF',
  DISPOSED: '#6B7280',
  LOST: '#991B1B',
};

export const STATUS_LABEL_TH: Record<string, string> = {
  DRAFT: 'ร่าง',
  SUBMITTED: 'แจ้งซ่อมแล้ว',
  RECEIVED: 'รับเรื่อง/ตรวจสอบ/วิเคราะห์ปัญหา',
  IT_REVIEW: 'ตรวจสอบเบื้องต้น',
  DIAGNOSIS: 'วิเคราะห์ปัญหา',
  WAITING_APPROVAL: 'รออนุมัติ',
  WAITING_PARTS: 'รออะไหล่',
  REPAIRING: 'กำลังซ่อม',
  TESTING: 'กำลังซ่อม/ทดสอบระบบ',
  VENDOR_REPAIR: 'ส่งซ่อมภายนอก',
  COMPLETED: 'ซ่อมเสร็จสิ้น/คืนอุปกรณ์แล้ว',
  RETURNED: 'คืนอุปกรณ์แล้ว',
  USER_ACCEPTANCE: 'ผู้แจ้งรับมอบ',
  CLOSED: 'ปิดงาน',
  CANCELLED: 'ยกเลิก',
  REJECTED: 'ปฏิเสธ',

  // สถานะครุภัณฑ์ (AssetStatus)
  ACTIVE: 'ใช้งานปกติ',
  IN_REPAIR: 'อยู่ระหว่างซ่อม',
  MAINTENANCE: 'ซ่อมบำรุง',
  RESERVED: 'สำรองใช้งาน',
  INACTIVE: 'ปิดใช้งาน',
  DISPOSED: 'จำหน่ายแล้ว',
  LOST: 'สูญหาย',
};

export function getStatusColor(code: string): string {
  return STATUS_COLORS[code] ?? '#9CA3AF';
}

export function getStatusLabel(code: string): string {
  return STATUS_LABEL_TH[code] ?? code;
}

/** ต้องตรงกับ backend/src/modules/assets/controllers/asset.controller.ts's ASSET_ACQUISITION_TYPE_LABEL_TH เสมอ */
export const ACQUISITION_TYPE_LABEL_TH: Record<string, string> = {
  PURCHASE: 'ซื้อ',
  LEASE_TO_OWN: 'เช่า-ซื้อ',
  LEASE_USE: 'เช่า-ใช้',
  DONATED: 'บริจาค/ได้รับบริจาค',
  BORROWED: 'ยืมตัวชั่วคราว',
  UNKNOWN: 'ไม่ทราบ',
};

export function getAcquisitionTypeLabel(code: string): string {
  return ACQUISITION_TYPE_LABEL_TH[code] ?? code;
}

export const URGENCY_LABEL_TH: Record<string, string> = {
  LOW: 'ต่ำ',
  MEDIUM: 'ปานกลาง',
  HIGH: 'สูง',
  CRITICAL: 'วิกฤต',
};

export const URGENCY_COLOR: Record<string, string> = {
  LOW: '#22C55E',
  MEDIUM: '#F59E0B',
  HIGH: '#EA580C',
  CRITICAL: '#EF4444',
};

export const EQUIPMENT_TYPE_OPTIONS: string[] = ['COMPUTER_CASE', 'NOTEBOOK', 'PRINTER', 'SCANNER', 'MONITOR', 'OTHER'];

export const EQUIPMENT_TYPE_LABEL_TH: Record<string, string> = {
  COMPUTER_CASE: 'Computer (Case)',
  NOTEBOOK: 'Notebook',
  PRINTER: 'Printer',
  SCANNER: 'Scanner',
  MONITOR: 'Monitor (จอคอมพิวเตอร์)',
  OTHER: 'อื่นๆ',
};

export const INSPECTION_OUTCOME_LABEL_TH: Record<string, string> = {
  IN_HOUSE: 'ตรวจสอบแล้ว ดำเนินการซ่อมได้',
  SEND_EXTERNAL: 'ตรวจสอบแล้ว ไม่สามารถซ่อมเองได้ เห็นควรส่งซ่อมภายนอก',
  REPLACE_NEW: 'ตรวจสอบแล้ว ซ่อมไม่คุ้มค่า เห็นควรซื้อใหม่ทดแทน',
};
