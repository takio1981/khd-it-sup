export interface IBackupEmailData {
  actionLabel: string;
  fileName: string;
  scope: string;
  errorMessage: string | null;
  detailUrl: string;
  isFailure: boolean;
}

/** Template อีเมลแจ้งเตือนสำรอง/กู้คืนข้อมูล ส่งถึง SUPER_ADMIN เท่านั้น — สีแดงเมื่อล้มเหลว (isFailure) เพื่อให้เห็นชัดว่าต้องรีบตรวจสอบ */
export function buildBackupEmailHtml(data: IBackupEmailData): string {
  const headerColor = data.isFailure ? '#DC2626' : '#006C45';
  const scopeLabel = data.scope === 'FULL' ? 'ทั้งหมด' : 'เฉพาะบางตาราง';
  return `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#F7FAF8;font-family:'Segoe UI',Tahoma,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7FAF8;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:${headerColor};padding:20px 24px;">
              <span style="color:#FFFFFF;font-size:16px;font-weight:600;">IT Service Desk — สำนักงานสาธารณสุขจังหวัดนครราชสีมา</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:600;">${escapeHtml(data.actionLabel)}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
                <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:120px;">ไฟล์</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${escapeHtml(data.fileName)}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">ขอบเขต</td><td style="padding:6px 0;color:#111827;font-size:13px;">${escapeHtml(scopeLabel)}</td></tr>
                ${data.errorMessage ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">ข้อผิดพลาด</td><td style="padding:6px 0;color:#DC2626;font-size:13px;">${escapeHtml(data.errorMessage)}</td></tr>` : ''}
              </table>

              <a href="${escapeAttribute(data.detailUrl)}" style="display:inline-block;background-color:#00A86B;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">ดูหน้าสำรอง/กู้คืนข้อมูล</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#F7FAF8;">
              <p style="margin:0;color:#9CA3AF;font-size:11px;">อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}

function escapeAttribute(text: string): string {
  return escapeHtml(text);
}
