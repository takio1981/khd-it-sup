export const LOAN_PURPOSE_OPTIONS: string[] = [
  'ใช้งานทดแทนระหว่างซ่อมเครื่องเดิม',
  'ใช้งานนอกสถานที่/ราชการ',
  'ใช้ในการประชุม/อบรม',
  'ทดสอบ/ทดลองใช้งาน',
];

export const LOAN_CONDITION_OPTIONS: string[] = [
  'สภาพดี ใช้งานได้ปกติ',
  'มีรอยขีดข่วนเล็กน้อย',
  'มีตำหนิ/ชำรุดบางส่วน',
];

export const OTHER_OPTION = 'อื่นๆ (ระบุเพิ่มเติม)';

/** แยกค่าที่บันทึกไว้แล้วว่าตรงกับตัวเลือกสำเร็จรูปหรือไม่ ถ้าไม่ตรงให้ถือเป็นค่ากำหนดเอง (Other) */
export function resolveDropdownPrefill(value: string | null | undefined, options: string[]): { select: string; other: string } {
  if (!value) return { select: '', other: '' };
  if (options.includes(value)) return { select: value, other: '' };
  return { select: OTHER_OPTION, other: value };
}
