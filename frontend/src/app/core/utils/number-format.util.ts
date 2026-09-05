/**
 * ใส่ "," คั่นหลักพัน ให้ตัวเลขจำนวนนับ/จำนวนเงินอ่านง่ายขึ้น (หลัก/สิบ/ร้อย/พัน/หมื่น/แสน/ล้าน)
 * รับได้ทั้ง number ตรงๆ และ string ตัวเลข (ฟิลด์ราคา/จำนวนเงินที่มาจาก Prisma Decimal จะ serialize เป็น string
 * เสมอ) — ถ้า parse เป็นตัวเลขไม่ได้ (เช่น placeholder "-") คืนค่าเดิมโดยไม่แตะต้อง
 *
 * ใช้ตัวนี้ตรงๆ ในโค้ด TS (เช่น string ที่ประกอบเป็น subtitle ของ PDF export) — ส่วนใน template ใช้ผ่าน
 * KhdNumberPipe (`| khdNumber`) ซึ่งเรียกฟังก์ชันนี้เหมือนกัน เพื่อไม่ให้ตรรกะการจัดรูปแบบซ้ำกันสองที่
 */
export function formatKhdNumber(value: number | string | null | undefined, decimals?: number): string {
  if (value === null || value === undefined) return '-';

  const num = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(num)) return String(value);

  const options = decimals === undefined ? { minimumFractionDigits: 0, maximumFractionDigits: 2 } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return num.toLocaleString('en-US', options);
}
