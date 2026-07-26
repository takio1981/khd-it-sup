/**
 * เรียก LINE Messaging API แบบ push ถึงเป้าหมายเดียวที่ตั้งค่าไว้ (Group ID หรือ User ID)
 * เลือกใช้ push แทน broadcast เพราะ broadcast ส่งถึงเฉพาะคนที่เพิ่มเพื่อน OA แบบ 1:1 เท่านั้น
 * ไม่ครอบคลุมสมาชิกในกลุ่มแชท (group chat) ซึ่งเป็นรูปแบบการใช้งานจริงของระบบนี้
 */
export async function sendLinePush(accessToken: string, targetId: string, text: string): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text }] }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LINE API error (HTTP ${res.status}): ${body}`);
  }
}
