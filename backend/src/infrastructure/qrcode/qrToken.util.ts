import crypto from 'node:crypto';
import { env } from '@config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM
const SHORT_CODE_BYTES = 6; // 6 ไบต์ = 8 ตัวอักษร base64url — สั้นพอให้ QR โปร่งขึ้นชัดเจน แต่ยังชนกันยากมาก (2^48)

/**
 * เข้ารหัส asset id เป็น token ที่ฝังใน QR Code (AES-256-GCM)
 * ป้องกันการเดา/ไล่สแกน asset id แบบ sequential ผ่าน URL public scan
 * รูปแบบ token: base64url(iv):base64url(authTag):base64url(ciphertext)
 */
export function encryptAssetId(assetId: string): string {
  const key = Buffer.from(env.QR_AES_SECRET, 'utf8');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(assetId, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((buf) => buf.toString('base64url')).join('.');
}

export function decryptAssetId(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid QR token format');
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key = Buffer.from(env.QR_AES_SECRET, 'utf8');
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(authTagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/** รหัสสั้นแบบสุ่ม ใช้แทน qr_token ตอนพิมพ์ QR จริง (ผ่าน /s/:shortCode redirect) เพื่อให้ QR หนาแน่นน้อยลง */
export function generateShortCode(): string {
  return crypto.randomBytes(SHORT_CODE_BYTES).toString('base64url');
}
