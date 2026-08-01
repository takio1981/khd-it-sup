export interface IForgotPasswordEmailData {
  fullName: string;
  username: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/** Template อีเมลลิงก์รีเซ็ตรหัสผ่านแบบ self-service (ต่างจาก passwordResetEmail.template.ts ซึ่งเป็นรหัสผ่านชั่วคราวที่ admin กดให้) */
export function buildForgotPasswordEmailHtml(data: IForgotPasswordEmailData): string {
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
              <p style="margin:0 0 8px;color:#111827;font-size:18px;font-weight:600;">คำขอตั้งรหัสผ่านใหม่</p>
              <p style="margin:0 0 16px;color:#6B7280;font-size:14px;">สวัสดีคุณ ${escapeHtml(data.fullName)} (${escapeHtml(data.username)})</p>
              <p style="margin:0 0 20px;color:#374151;font-size:13px;line-height:1.6;">มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กรุณากดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้จะหมดอายุภายใน ${data.expiresInMinutes} นาที</p>

              <a href="${escapeAttribute(data.resetUrl)}" style="display:inline-block;background-color:#00A86B;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">ตั้งรหัสผ่านใหม่</a>

              <p style="margin:20px 0 0;color:#9CA3AF;font-size:12px;line-height:1.6;">หากคุณไม่ได้ร้องขอการตั้งรหัสผ่านใหม่นี้ กรุณาเพิกเฉยต่ออีเมลนี้ รหัสผ่านปัจจุบันของคุณจะไม่ถูกเปลี่ยนแปลง</p>
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
