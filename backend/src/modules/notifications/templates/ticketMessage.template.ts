const URGENCY_LABEL_TH: Record<string, string> = {
  LOW: 'ต่ำ',
  MEDIUM: 'ปานกลาง',
  HIGH: 'สูง',
  CRITICAL: 'วิกฤต',
};

export interface ITicketMessageData {
  ticketNumber: string;
  description: string;
  urgency: string;
  statusNameTh: string;
  reporterName: string;
  assetLabel?: string | null;
  actionLabel: string;
  detailUrl: string;
}

/** ข้อความแจ้งเตือนงานซ่อมแบบ plain text ใช้ร่วมกันทั้ง Telegram และ LINE (ไม่รองรับ HTML เหมือนอีเมล) */
export function buildTicketMessageText(data: ITicketMessageData): string {
  const lines = [
    `🔔 ${data.actionLabel}`,
    `เลขที่ใบแจ้งซ่อม: ${data.ticketNumber}`,
    `สถานะ: ${data.statusNameTh}`,
    `ความเร่งด่วน: ${URGENCY_LABEL_TH[data.urgency] ?? data.urgency}`,
  ];
  if (data.assetLabel) lines.push(`ครุภัณฑ์: ${data.assetLabel}`);
  lines.push(`ผู้แจ้ง: ${data.reporterName}`);
  lines.push('');
  lines.push(data.description);
  lines.push('');
  lines.push(`ดูรายละเอียด: ${data.detailUrl}`);
  return lines.join('\n');
}
