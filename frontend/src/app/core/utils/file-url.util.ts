import { environment } from '../../../environments/environment';

/**
 * Backend คืน fileUrl แบบ root-relative โดยอิง API_PREFIX ของตัวเอง (เช่น "/api/v1/files/...")
 * โดยไม่รู้จัก path prefix ของ reverse proxy ภายนอก (เช่น "/khd-it-sup") — ต้องแปลงให้ตรงกับ
 * environment.apiBaseUrl ก่อนเรียกจริงเสมอ ไม่งั้นจะพลาด prefix เวลา deploy ใต้ subpath
 */
export function resolveBackendFileUrl(fileUrl: string): string {
  const proxyPrefix = environment.apiBaseUrl.replace(/\/api\/v1$/, '');
  return fileUrl.startsWith(proxyPrefix) ? fileUrl : `${proxyPrefix}${fileUrl}`;
}
