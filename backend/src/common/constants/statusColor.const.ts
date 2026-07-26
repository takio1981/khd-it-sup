/**
 * สีมาตรฐานของสถานะงานซ่อม ใช้ทั้งฝั่ง Backend (เอกสาร/PDF) และส่งให้ Frontend แสดงผล Timeline/Kanban
 * ตรงตามสเปกหัวข้อ "Status Color" — เป็น fallback เมื่อ workflow_steps.color_code ไม่ได้ถูกตั้งค่า
 */
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
  VENDOR_REPAIR: '#EA580C',
  COMPLETED: '#22C55E',
  RETURNED: '#14B8A6',
  USER_ACCEPTANCE: '#14B8A6',
  CLOSED: '#166534',
  CANCELLED: '#EF4444',
  REJECTED: '#991B1B',
};

export function getStatusColor(stepCode: string): string {
  return STATUS_COLORS[stepCode] ?? '#9CA3AF';
}
