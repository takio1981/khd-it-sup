/**
 * ถ่ายภาพหน้าจอ (screenshot) ของ element ที่ระบุแล้วแปลงเป็น PDF ผ่าน jsPDF + html2canvas (dynamic import)
 * ต่างจาก pdf-table-export.util.ts ตรงที่นี่ capture DOM ที่แสดงอยู่จริงบนจอ (เช่น dashboard พร้อมกราฟ)
 * แทนที่จะสร้างตารางขึ้นมาใหม่นอกจอ — เหมาะกับเนื้อหาที่ไม่มีการแบ่งหน้า/pagination ต้องกังวล
 */
export async function exportElementToPdf(
  elementId: string,
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const target = document.getElementById(elementId);
  if (!target) return;

  // scale 1.5 + JPEG (ไม่ใช่ PNG) — เนื้อหาที่มีตัวอักษร anti-aliased จำนวนมากทำให้ PNG บีบอัดได้แย่มาก
  // (ไฟล์บวมเป็นสิบ MB) JPEG คุณภาพ 0.9 ให้ไฟล์เล็กลงมากโดยคุณภาพยังชัดเจนเพียงพอสำหรับรายงาน
  const canvas = await html2canvas(target, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/jpeg', 0.9);

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
