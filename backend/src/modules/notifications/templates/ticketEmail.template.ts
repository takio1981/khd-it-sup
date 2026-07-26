const URGENCY_LABEL_TH: Record<string, string> = {
  LOW: 'ต่ำ',
  MEDIUM: 'ปานกลาง',
  HIGH: 'สูง',
  CRITICAL: 'วิกฤต',
};

export interface ITicketEmailData {
  ticketNumber: string;
  description: string;
  urgency: string;
  statusNameTh: string;
  reporterName: string;
  assetLabel?: string | null;
  actionLabel: string;
  detailUrl: string;
}

/** Template อีเมลแจ้งเตือนงานซ่อม ใช้โทนสีองค์กร (เขียว #006C45) ตาม UI/UX spec */
export function buildTicketEmailHtml(data: ITicketEmailData): string {
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
            <td style="background-color:#006C45;padding:20px 24px;">
              <span style="color:#FFFFFF;font-size:16px;font-weight:600;">IT Service Desk — สำนักงานสาธารณสุขจังหวัดนครราชสีมา</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:600;">${escapeHtml(data.actionLabel)}</p>
              <p style="margin:0 0 16px;color:#6B7280;font-size:14px;">เลขที่ใบแจ้งซ่อม <strong style="color:#006C45;">${escapeHtml(data.ticketNumber)}</strong></p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
                <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:120px;">สถานะปัจจุบัน</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${escapeHtml(data.statusNameTh)}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">ความเร่งด่วน</td><td style="padding:6px 0;color:#111827;font-size:13px;">${escapeHtml(URGENCY_LABEL_TH[data.urgency] ?? data.urgency)}</td></tr>
                ${data.assetLabel ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">ครุภัณฑ์</td><td style="padding:6px 0;color:#111827;font-size:13px;">${escapeHtml(data.assetLabel)}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">ผู้แจ้ง</td><td style="padding:6px 0;color:#111827;font-size:13px;">${escapeHtml(data.reporterName)}</td></tr>
              </table>

              <p style="margin:0 0 20px;color:#374151;font-size:13px;line-height:1.6;background:#F7FAF8;padding:12px;border-radius:8px;">${escapeHtml(data.description)}</p>

              <a href="${escapeAttribute(data.detailUrl)}" style="display:inline-block;background-color:#00A86B;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">ดูรายละเอียด</a>
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
