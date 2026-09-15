export interface IBackupMessageData {
  actionLabel: string;
  fileName: string;
  scope: string;
  errorMessage: string | null;
  detailUrl: string;
  isFailure: boolean;
}

/** ข้อความแจ้งเตือนสำรอง/กู้คืนข้อมูลแบบ plain text ใช้ร่วมกันทั้ง Telegram และ LINE */
export function buildBackupMessageText(data: IBackupMessageData): string {
  const icon = data.isFailure ? '🔴' : '🗄️';
  const scopeLabel = data.scope === 'FULL' ? 'ทั้งหมด' : 'เฉพาะบางตาราง';
  const lines = [`${icon} ${data.actionLabel}`, `ไฟล์: ${data.fileName}`, `ขอบเขต: ${scopeLabel}`];
  if (data.errorMessage) lines.push(`ข้อผิดพลาด: ${data.errorMessage}`);
  lines.push('');
  lines.push(`ดูรายละเอียด: ${data.detailUrl}`);
  return lines.join('\n');
}
