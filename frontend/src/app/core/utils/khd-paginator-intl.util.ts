import { MatPaginatorIntl } from '@angular/material/paginator';
import { formatKhdNumber } from './number-format.util';

/** ข้อความ paginator ภาษาไทย + ตัวเลขคั่นหลักพัน (ตรรกะคำนวณช่วงเหมือน Angular Material เดิมทุกประการ) */
export function provideKhdPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'แสดงต่อหน้า';
  intl.nextPageLabel = 'หน้าถัดไป';
  intl.previousPageLabel = 'หน้าก่อนหน้า';
  intl.firstPageLabel = 'หน้าแรก';
  intl.lastPageLabel = 'หน้าสุดท้าย';
  intl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 จาก ${formatKhdNumber(length)}`;
    }
    const safeLength = Math.max(length, 0);
    const startIndex = page * pageSize;
    const endIndex = startIndex < safeLength ? Math.min(startIndex + pageSize, safeLength) : startIndex + pageSize;
    return `${formatKhdNumber(startIndex + 1)}–${formatKhdNumber(endIndex)} จาก ${formatKhdNumber(safeLength)}`;
  };
  return intl;
}
