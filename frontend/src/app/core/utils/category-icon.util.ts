import type { IconName } from '../../shared/components/icon/icon.data';

/** asset_categories.icon เก็บเป็นชื่อ Heroicons component แบบ PascalCase (ดู database/seed.sql) — map เป็นชื่อ key แบบ kebab-case ที่ khd-icon ใช้ */
const CATEGORY_ICON_MAP: Record<string, IconName> = {
  ComputerDesktopIcon: 'computer-desktop',
  DevicePhoneMobileIcon: 'device-phone-mobile',
  PrinterIcon: 'printer',
  ScannerIcon: 'viewfinder-circle',
  BoltIcon: 'bolt',
  ShareIcon: 'share',
  WifiIcon: 'wifi',
  ShieldCheckIcon: 'shield-check',
  ServerIcon: 'server',
  VideoCameraIcon: 'video-camera',
  CloudIcon: 'cloud',
  HeartIcon: 'heart',
  CubeIcon: 'cube',
};

/** ไม่พบรูปภาพครุภัณฑ์ที่บันทึกไว้ — ใช้ icon ของประเภทครุภัณฑ์นั้นแทน (ไม่รู้จัก/ไม่มีค่า ใช้ cube เป็นค่าเริ่มต้นกลาง ๆ) */
export function getCategoryIconName(icon: string | null | undefined): IconName {
  return (icon && CATEGORY_ICON_MAP[icon]) || 'cube';
}
