import type { Permission } from '../core/models/auth.model';

export interface INavItem {
  label: string;
  route: string;
  icon: string;
  /** เว้นว่าง = แสดงให้ผู้ใช้ที่ login แล้วทุกคน (ไม่จำกัดสิทธิ์) */
  permissions?: Permission[];
}

export const NAV_ITEMS: INavItem[] = [
  { label: 'แดชบอร์ด', route: '/dashboard', icon: 'home', permissions: ['dashboard:view'] },
  { label: 'งานแจ้งซ่อม', route: '/repair-tickets', icon: 'wrench-screwdriver', permissions: ['ticket:read', 'ticket:track'] },
  { label: 'ครุภัณฑ์', route: '/assets', icon: 'computer-desktop', permissions: ['asset:read'] },
  { label: 'ยืมครุภัณฑ์-อุปกรณ์', route: '/asset-loans', icon: 'arrow-path', permissions: ['asset:loan'] },
  { label: 'คลังอะไหล่', route: '/spare-parts', icon: 'archive-box', permissions: ['spare_part:view', 'spare_part:manage', 'spare_part:issue'] },
  { label: 'ผู้ใช้งาน', route: '/users', icon: 'users', permissions: ['user:read'] },
  { label: 'จัดการสถานที่/หน่วยงาน', route: '/departments', icon: 'building-office-2', permissions: ['department:manage'] },
  { label: 'ตั้งค่าแจ้งเตือน', route: '/settings/notifications', icon: 'bell', permissions: ['settings:manage', 'audit:view'] },
  { label: 'ตั้งค่าทั่วไป', route: '/settings/general', icon: 'adjustments-horizontal', permissions: ['settings:manage', 'audit:view'] },
  { label: 'ประวัติการใช้งานระบบ', route: '/settings/audit-log', icon: 'clipboard-document-list', permissions: ['audit:view'] },
  { label: 'คู่มือการใช้งาน', route: '/help', icon: 'document-text' },
];
