/** trigger เบราว์เซอร์ดาวน์โหลดไฟล์จาก Blob response (ใช้กับ export endpoint ที่ต้อง Authorization header — <a href> ตรงๆ ทำไม่ได้) */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
