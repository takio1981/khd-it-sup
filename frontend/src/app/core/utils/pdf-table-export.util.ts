/**
 * สร้างตารางแบบพิมพ์ได้ชั่วคราวนอกจอ (ไม่กระทบ layout จริง) แล้วแปลงเป็น PDF ผ่าน jsPDF + html2canvas
 * (dynamic import — โหลดเฉพาะตอนกดปุ่ม export เพื่อไม่ให้ bundle หลักหนักขึ้นโดยไม่จำเป็น)
 * ใช้ pattern เดียวกับ ticket-print-preview.component.ts (khd-print-area + html2canvas + jsPDF)
 */
export interface IPdfTableExportOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

export async function exportTableToPdf(opts: IPdfTableExportOptions): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1200px';
  container.style.background = '#ffffff';
  container.style.padding = '24px';
  container.style.fontFamily = "'Sarabun', 'Noto Sans Thai', sans-serif";

  const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const headerCells = opts.columns.map((c) => `<th style="text-align:left;padding:8px;border-bottom:2px solid #111827;font-size:12px;">${escapeHtml(c)}</th>`).join('');
  const bodyRows = opts.rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#F7FAF8'}">${row
          .map((cell) => `<td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:11px;color:#111827;">${escapeHtml(cell)}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  container.innerHTML = `
    <h1 style="font-size:18px;margin:0 0 4px;color:#111827;">${escapeHtml(opts.title)}</h1>
    ${opts.subtitle ? `<p style="font-size:12px;color:#6B7280;margin:0 0 16px;">${escapeHtml(opts.subtitle)}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;

  document.body.appendChild(container);
  try {
    // scale 1.5 + JPEG (ไม่ใช่ PNG) — ตารางข้อความ anti-aliased ทำให้ PNG บีบอัดได้แย่มาก (ไฟล์บวมเป็นสิบ MB
    // จากตารางแค่ไม่กี่สิบแถว) JPEG คุณภาพ 0.9 ให้ไฟล์เล็กลงมากโดยคุณภาพงานพิมพ์ยังชัดเจนเพียงพอ
    const canvas = await html2canvas(container, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);

    const pdf = new jsPDF({ orientation: opts.orientation ?? 'landscape', unit: 'mm', format: 'a4' });
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

    pdf.save(opts.filename);
  } finally {
    document.body.removeChild(container);
  }
}
