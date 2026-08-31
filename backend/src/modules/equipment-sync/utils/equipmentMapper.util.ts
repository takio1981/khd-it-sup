import type { AssetStatus, Department } from '@prisma/client';
import { logger } from '@infrastructure/logger/logger';
import type { IMophEquipmentRecord } from '@infrastructure/moph/mophEquipment.client';

const TEXT_FIELD_MAX_LENGTH = 150;
const LOCATION_NOTE_MAX_LENGTH = 255;

/** MOPH ส่งมาแค่ null (ปกติ) กับ 'discharge' (จำหน่ายแล้ว) เท่านั้นจากข้อมูลจริงที่สำรวจ — ค่าอื่นที่ไม่รู้จักให้ default เป็น ACTIVE และ log ไว้ ไม่ throw กันทั้ง run พัง */
export function mapStatus(raw: string | null): AssetStatus {
  if (!raw) return 'ACTIVE';
  if (raw === 'discharge') return 'DISPOSED';
  logger.warn(`[equipment-sync] พบค่า status ที่ไม่รู้จักจาก MOPH: "${raw}" — ใช้ ACTIVE แทน`);
  return 'ACTIVE';
}

/**
 * equip_group ของ MOPH มีแค่ 5 กลุ่มกว้าง ๆ (รวมปริ้นเตอร์/จอ/UPS/เครือข่ายไว้เป็น "ครุภัณฑ์คอมพิวเตอร์" กลุ่มเดียว)
 * จึงต้องแยกละเอียดด้วย keyword จาก equip_sub_name/detail แทน — ที่ตรงกับ 14 หมวดเดิมเท่านั้น ที่เหลือเข้า OTHER
 * ตรวจ NOTEBOOK ก่อน COMPUTER เสมอ (ชื่อ "คอมพิวเตอร์โน้ตบุ๊ก" มีคำว่า "คอมพิวเตอร์" ปนอยู่)
 */
const CATEGORY_KEYWORD_RULES: Array<{ code: string; pattern: RegExp }> = [
  { code: 'NOTEBOOK', pattern: /โน้?ตบุ๊ก|notebook|laptop/i },
  { code: 'PRINTER', pattern: /เครื่องพิมพ์|ปริ้นเตอร์|printer/i },
  { code: 'SCANNER', pattern: /สแกน|scanner/i },
  { code: 'UPS', pattern: /สำรองไฟ|\bups\b/i },
  { code: 'SWITCH', pattern: /สวิตช์เครือข่าย|network switch/i },
  { code: 'ROUTER', pattern: /เราเตอร์|router/i },
  { code: 'FIREWALL', pattern: /ไฟร์วอลล์|firewall/i },
  { code: 'SERVER', pattern: /เครื่องแม่ข่าย|\bserver\b/i },
  { code: 'MONITOR', pattern: /จอภาพ|จอคอมพิวเตอร์|monitor/i },
  { code: 'PROJECTOR', pattern: /โปรเจคเตอร์|เครื่องฉายภาพ|projector/i },
  { code: 'COMPUTER', pattern: /คอมพิวเตอร์|computer/i },
  { code: 'AC', pattern: /เครื่องปรับอากาศ|แอร์|air.?condition/i },
  { code: 'MEDICAL', pattern: /ครุภัณฑ์การแพทย์|เครื่องมือแพทย์|medical/i },
];

const AC_EQUIP_CLASS = '4120'; // รหัสจำแนกครุภัณฑ์ราชการมาตรฐานของเครื่องปรับอากาศ — ใช้เป็น fallback ที่เชื่อถือได้แม้ข้อความจะไม่ระบุคำว่า "แอร์"

export function resolveCategoryCode(record: IMophEquipmentRecord): string {
  const haystack = `${record.equip_sub_name ?? ''} ${record.detail ?? ''}`;
  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (rule.pattern.test(haystack)) return rule.code;
  }
  if (record.equip_class === AC_EQUIP_CLASS) return 'AC';
  return 'OTHER';
}

export function normalizePrice(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0) return null;
  return value;
}

export function normalizeDate(raw: string | null): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function truncateText(value: string | null, maxLength = TEXT_FIELD_MAX_LENGTH): string | null {
  if (!value) return null;
  return value.slice(0, maxLength);
}

/**
 * รวมข้อมูลที่ไม่มีช่องเก็บโดยตรงในตาราง assets ไว้ใน remark เป็นข้อความอ่านง่าย
 * budget_year เก็บเป็นข้อความดิบโดยตั้งใจ — ข้อมูลจริงปนกันทั้ง พ.ศ. (เช่น 2568) และ ค.ศ. (เช่น 2026) ไม่สามารถ normalize ได้อย่างน่าเชื่อถือ
 */
export function composeRemark(record: IMophEquipmentRecord): string {
  const lines = ['นำเข้าอัตโนมัติจากระบบ MOPH AssetTracker'];
  if (record.owner) lines.push(`ผู้ครอบครองจากระบบ MOPH: ${record.owner}`);
  if (record.budget_year) lines.push(`ปีงบประมาณ (ข้อมูลดิบจากระบบต้นทาง ไม่แปลง พ.ศ./ค.ศ.): ${record.budget_year}`);
  if (record.detail) lines.push(`รายละเอียดจากระบบต้นทาง: ${record.detail}`);
  return lines.join('\n');
}

export interface IResolvedDepartment {
  departmentId: string | null;
  locationNote: string | null;
}

/** Match ตรงตัว (trim) กับ departments.name_th เท่านั้น — ไม่ fuzzy เพราะจับคู่หน่วยงานผิดจะสร้างความเสียหายมากกว่าปล่อยว่างไว้ */
export function resolveDepartment(locationName: string | null, departmentIndex: Map<string, Department>): IResolvedDepartment {
  const trimmed = locationName?.trim();
  if (!trimmed) return { departmentId: null, locationNote: null };

  const matched = departmentIndex.get(trimmed);
  if (matched) return { departmentId: matched.id, locationNote: null };

  const note = `หน่วยงานจากระบบ MOPH (ไม่พบชื่อที่ตรงกันในระบบ): ${trimmed}`;
  return { departmentId: null, locationNote: note.slice(0, LOCATION_NOTE_MAX_LENGTH) };
}

export function buildDepartmentIndex(departments: Department[]): Map<string, Department> {
  const index = new Map<string, Department>();
  for (const dept of departments) {
    index.set(dept.nameTh.trim(), dept);
  }
  return index;
}
