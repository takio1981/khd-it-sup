export interface ISendTelegramResult {
  messageId: number;
}

interface ITelegramApiResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

/** เรียก Telegram Bot API โดยตรง (sendMessage) — ไม่ต้องใช้ library เพิ่ม ใช้ fetch ที่มีอยู่แล้วใน Node 20 */
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<ISendTelegramResult> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const data = (await res.json()) as ITelegramApiResponse;
  if (!data.ok || !data.result) {
    throw new Error(data.description ?? `Telegram API error (HTTP ${res.status})`);
  }
  return { messageId: data.result.message_id };
}
