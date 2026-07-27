export interface IAssetLoanMessageData {
  assetLabel: string;
  borrowerName: string;
  actionLabel: string;
  borrowDate: Date;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  purpose: string | null;
  detailUrl: string;
}

function formatThaiDate(date: Date): string {
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** ข้อความแจ้งเตือนยืม/คืนครุภัณฑ์-อุปกรณ์แบบ plain text ใช้ร่วมกันทั้ง Telegram และ LINE */
export function buildAssetLoanMessageText(data: IAssetLoanMessageData): string {
  const lines = [
    `📦 ${data.actionLabel}`,
    `ครุภัณฑ์: ${data.assetLabel}`,
    `ผู้ยืม: ${data.borrowerName}`,
    `วันที่ยืม: ${formatThaiDate(data.borrowDate)}`,
  ];
  if (data.expectedReturnDate) lines.push(`กำหนดคืน: ${formatThaiDate(data.expectedReturnDate)}`);
  if (data.actualReturnDate) lines.push(`วันที่คืน: ${formatThaiDate(data.actualReturnDate)}`);
  if (data.purpose) lines.push(`วัตถุประสงค์: ${data.purpose}`);
  lines.push('');
  lines.push(`ดูรายละเอียด: ${data.detailUrl}`);
  return lines.join('\n');
}
