import ExcelJS from 'exceljs';

export interface IExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface IExportSheet {
  sheetName: string;
  columns: IExportColumn[];
  rows: Record<string, unknown>[];
}

export async function buildMultiSheetExcelBuffer(sheets: IExportSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const s of sheets) {
    const sheet = workbook.addWorksheet(s.sheetName);
    sheet.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
    sheet.getRow(1).font = { bold: true };
    s.rows.forEach((r) => sheet.addRow(r));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildExcelBuffer(
  sheetName: string,
  columns: IExportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  return buildMultiSheetExcelBuffer([{ sheetName, columns, rows }]);
}

function escapeCsvValue(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** ขึ้นต้นด้วย UTF-8 BOM เสมอ — ไม่งั้น Excel เปิดไฟล์ CSV ภาษาไทยเป็นตัวอักษรเพี้ยน (mojibake) */
export function buildCsv(columns: IExportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCsvValue(c.header)).join(',');
  const lines = rows.map((r) => columns.map((c) => escapeCsvValue(r[c.key])).join(','));
  return String.fromCharCode(0xfeff) + [header, ...lines].join('\r\n');
}
