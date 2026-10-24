import type { Permission } from '../core/models/auth.model';

export interface INavItem {
  label: string;
  route: string;
  icon: string;
  /** เว้นว่าง = แสดงให้ผู้ใช้ที่ login แล้วทุกคน (ไม่จำกัดสิทธิ์) */
  permissions?: Permission[];
  /** แสดงในแถบเมนูล่างบนมือถือด้วย (เรียงตามลำดับใน array, สูงสุด 3 รายการหลังกรองสิทธิ์) */
  mobile?: boolean;
  /** ชื่อสั้นสำหรับแถบเมนูล่างมือถือ */
  shortLabel?: string;
}

export interface INavGroup {
  label: string;
  items: INavItem[];
}

export const NAV_GROUPS: INavGroup[] = [
  {
    label: 'ภาพรวม',
    items: [
      { label: 'แดชบอร์ด', route: '/dashboard', icon: 'squares-2x2', permissions: ['dashboard:view'], mobile: true },
      { label: 'รายงาน', route: '/reports', icon: 'presentation-chart-line', permissions: ['report:view'] },
    ],
  },
  {
    label: 'งานบริการ',
    items: [
      { label: 'งานแจ้งซ่อม', route: '/repair-tickets', icon: 'wrench-screwdriver', permissions: ['ticket:read', 'ticket:track'], mobile: true },
      { label: 'ยืมครุภัณฑ์-อุปกรณ์', route: '/asset-loans', icon: 'arrow-path', permissions: ['asset:loan'], mobile: true, shortLabel: 'ยืม-คืน' },
    ],
  },
  {
    label: 'ครุภัณฑ์และคลัง',
    items: [
      { label: 'ครุภัณฑ์', route: '/assets', icon: 'computer-desktop', permissions: ['asset:read'], mobile: true },
      { label: 'คลังอะไหล่', route: '/spare-parts', icon: 'archive-box', permissions: ['spare_part:view', 'spare_part:manage', 'spare_part:issue'] },
      { label: 'ผู้ขาย/ผู้รับซ่อมภายนอก', route: '/vendors', icon: 'truck', permissions: ['vendor:view', 'vendor:manage'] },
    ],
  },
  {
    label: 'ข้อมูลหลัก',
    items: [
      { label: 'ผู้ใช้งาน', route: '/users', icon: 'users', permissions: ['user:read'] },
      { label: 'จัดการสถานที่/หน่วยงาน', route: '/departments', icon: 'building-library', permissions: ['department:manage'] },
    ],
  },
  {
    label: 'ตั้งค่าระบบ',
    items: [
      { label: 'ตั้งค่าทั่วไป', route: '/settings/general', icon: 'adjustments-horizontal', permissions: ['settings:manage', 'audit:view'] },
      { label: 'ตั้งค่าแจ้งเตือน', route: '/settings/notifications', icon: 'bell', permissions: ['settings:manage', 'audit:view'] },
      { label: 'ประวัติการใช้งานระบบ', route: '/settings/audit-log', icon: 'clipboard-document-list', permissions: ['audit:view'] },
      { label: 'ประวัติเอกสารราชการ', route: '/settings/documents', icon: 'document-text', permissions: ['document:print', 'document:generate', 'audit:view'] },
      { label: 'สำรอง/กู้คืนข้อมูล', route: '/settings/backup', icon: 'circle-stack', permissions: ['backup:manage'] },
    ],
  },
  {
    label: 'ช่วยเหลือ',
    items: [
      { label: 'คู่มือการใช้งาน', route: '/help', icon: 'book-open' },
      { label: 'ผังการทำงานระบบ (SOP)', route: '/workflows', icon: 'share' },
    ],
  },
];

/** หน้าในเมนูผู้ใช้ (ไม่แสดงใน sidebar) — ใช้แสดงชื่อหน้าใน top bar */
export const ACCOUNT_NAV_GROUP: INavGroup = {
  label: 'บัญชีของฉัน',
  items: [
    { label: 'ตั้งค่า PIN เข้าสู่ระบบ', route: '/auth/setup-pin', icon: 'shield-check' },
    { label: 'ช่องทางการแจ้งเตือนส่วนตัว', route: '/auth/notification-channels', icon: 'bell' },
  ],
};

/** รายการเมนูแบบแบน (ใช้หาชื่อหน้าปัจจุบัน/เมนูล่างมือถือ) */
export const NAV_ITEMS: INavItem[] = NAV_GROUPS.flatMap((g) => g.items);
