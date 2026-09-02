/** Role codes — ต้องตรงกับ `roles.code` ใน database/seed.sql เสมอ */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  IT_OFFICER: 'IT_OFFICER',
  TECHNICIAN: 'TECHNICIAN',
  USER: 'USER',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

/** กลุ่ม role "เจ้าหน้าที่" (แอดมิน/ช่าง) — ใช้กำหนดผู้รับแจ้งเตือนงานแจ้งซ่อมใหม่และผู้ที่นับเป็น "ผู้เข้าดูคนแรก" ได้
 * ต่างจาก permission ticket:read ตรงที่ role USER (ผู้แจ้งซ่อมทั่วไป) ก็มี ticket:read ด้วยเช่นกัน (ดู seed.ts)
 * จึงต้องเช็คจาก role ตรง ๆ ไม่ใช้ permission เป็นตัวกรองกลุ่มนี้ */
export const STAFF_ROLES: readonly RoleCode[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_OFFICER, ROLES.TECHNICIAN];
