import QRCode from 'qrcode';

/** สร้าง QR Code เป็น PNG buffer จาก URL ที่ฝัง encrypted token (ใช้ error correction level 'M' — สมดุลระหว่างความหนาแน่นกับความทนทานต่อรอยขีดข่วนบนสติกเกอร์) */
export async function generateQrPngBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#006C45', light: '#FFFFFF' },
  });
}

export async function generateQrDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: { dark: '#006C45', light: '#FFFFFF' },
  });
}
