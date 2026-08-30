/** แปลง User-Agent เป็นชื่ออุปกรณ์อ่านง่าย ใช้แสดงผลในหน้ารายการอุปกรณ์ที่เชื่อถือ PIN เท่านั้น ไม่ใช่ข้อมูลที่ security ใดๆ พึ่งพา */
export function deriveDeviceLabel(userAgent: string | undefined): string {
  const ua = userAgent ?? '';

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'เบราว์เซอร์';

  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';

  return os ? `${browser} บน ${os}` : browser;
}
