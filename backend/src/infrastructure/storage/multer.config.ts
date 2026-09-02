import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { env } from '@config/env';
import { BadRequestError } from '@common/errors';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

/** ใช้กับไฟล์แนบใบแจ้งซ่อม (รูป/วิดีโอหน้างานเท่านั้น ไม่รับ PDF/เอกสารอื่น) */
const IMAGE_AND_VIDEO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

/** ใช้กับรูปโปรไฟล์ผู้ใช้ — เฉพาะรูปภาพเท่านั้น ไม่รับ PDF/วิดีโอ */
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** จัดเก็บไฟล์แยกโฟลเดอร์ตามประเภท (subDir) นอก web root — เข้าถึงผ่าน API endpoint ที่ตรวจสิทธิ์เท่านั้น ไม่ serve static ตรง ๆ */
function buildStorage(subDir: string): multer.StorageEngine {
  const uploadPath = path.resolve(env.UPLOAD_DIR, subDir);
  fs.mkdirSync(uploadPath, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadPath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

function buildFileFilter(allowedMimeTypes: Set<string>) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    // ตัดพารามิเตอร์ codec ทิ้งก่อนเทียบ — วิดีโอที่อัดจาก MediaRecorder ของเบราว์เซอร์ (เช่นฟีเจอร์ถ่ายวิดีโอผ่านกล้อง)
    // รายงาน mimetype พร้อม codecs เสมอ เช่น "video/webm;codecs=vp9,opus" ซึ่งไม่ตรงกับ allowlist แบบตรงตัว
    const baseMimeType = file.mimetype.split(';')[0].trim();
    if (!allowedMimeTypes.has(baseMimeType)) {
      cb(new BadRequestError(`ไม่รองรับชนิดไฟล์: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  };
}

export function createUploader(
  subDir: string,
  options?: { allowedMimeTypes?: Set<string>; maxFileSizeMB?: number },
) {
  return multer({
    storage: buildStorage(subDir),
    fileFilter: buildFileFilter(options?.allowedMimeTypes ?? ALLOWED_MIME_TYPES),
    limits: { fileSize: (options?.maxFileSizeMB ?? env.UPLOAD_MAX_FILE_SIZE_MB) * 1024 * 1024 },
  });
}

export const assetPhotoUploader = createUploader('assets');
/** ไฟล์แนบใบแจ้งซ่อม — เฉพาะรูปภาพ/วิดีโอหน้างาน ขนาดไม่เกิน 10 MB ต่อไฟล์ (ตอนแจ้งซ่อมใหม่ยังบังคับรวมกันไม่เกิน
 *  10 MB เพิ่มอีกชั้นที่ controller ด้วย — ดู CREATE_MAX_TOTAL_ATTACHMENT_BYTES ใน repairTicket.controller.ts) */
export const ticketAttachmentUploader = createUploader('tickets', {
  allowedMimeTypes: IMAGE_AND_VIDEO_MIME_TYPES,
  maxFileSizeMB: 10,
});
/** รูปโปรไฟล์ผู้ใช้ — เฉพาะรูปภาพ ขนาดไม่เกิน 2 MB */
export const avatarUploader = createUploader('avatars', {
  allowedMimeTypes: AVATAR_MIME_TYPES,
  maxFileSizeMB: 2,
});
/** โลโก้องค์กร (ตั้งค่าทั่วไป) — เฉพาะรูปภาพ ขนาดไม่เกิน 2 MB */
export const logoUploader = createUploader('logos', {
  allowedMimeTypes: AVATAR_MIME_TYPES,
  maxFileSizeMB: 2,
});
/** ใบเสนอราคา/ใบแจ้งหนี้จากผู้รับซ่อมภายนอก — รูปภาพหรือ PDF (ใช้ default ALLOWED_MIME_TYPES) */
export const vendorDocUploader = createUploader('vendor-docs');
/** เอกสารราชการที่ออกเลขที่วิ่งแล้ว (PDF ที่ frontend render มาแล้ว) */
export const documentUploader = createUploader('documents');

/** ลบไฟล์ที่เคยอัปโหลดไว้ตาม fileUrl เดิม (best-effort — ไม่ throw ถ้าไฟล์ไม่มีอยู่แล้ว) ใช้ตอนแทนที่รูปเดิมด้วยรูปใหม่ */
export function deleteUploadedFileByUrl(fileUrl: string, subDir: string): void {
  const filename = path.basename(fileUrl);
  const filePath = path.resolve(env.UPLOAD_DIR, subDir, filename);
  fs.unlink(filePath, () => undefined);
}
