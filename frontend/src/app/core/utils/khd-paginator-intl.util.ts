import { MatPaginatorIntl } from '@angular/material/paginator';
import { formatKhdNumber } from './number-format.util';

/**
 * ทับเฉพาะ getRangeLabel ของ MatPaginatorIntl ให้ตัวเลขมี "," คั่นหลักพัน (ตรรกะเดิมของ Angular Material
 * ทุกอย่างเหมือนเดิมทุกประการ แค่ห่อตัวเลขด้วย formatKhdNumber) — ไม่แตะคำ/label อื่นๆ (Items per page ฯลฯ)
 * เพราะอยู่นอกขอบเขตงานนี้ (งานนี้คือใส่ "," ให้ตัวเลข ไม่ใช่แปลข้อความ)
 */
export function provideKhdPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 of ${formatKhdNumber(length)}`;
    }
    const safeLength = Math.max(length, 0);
    const startIndex = page * pageSize;
    const endIndex = startIndex < safeLength ? Math.min(startIndex + pageSize, safeLength) : startIndex + pageSize;
    return `${formatKhdNumber(startIndex + 1)} – ${formatKhdNumber(endIndex)} of ${formatKhdNumber(safeLength)}`;
  };
  return intl;
}
