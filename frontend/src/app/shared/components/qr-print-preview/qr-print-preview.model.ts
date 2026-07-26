export interface IQrLabelData {
  assetId: string;
  assetNumber: string;
  categoryNameTh: string;
  brand: string | null;
  model: string | null;
  govAssetNumber: string | null;
  departmentNameTh: string | null;
  /** รูป QR — data: URL (จาก generate) หรือ blob object URL (จาก print) */
  imageSrc: string;
  scanUrl: string;
}

export interface IQrPrintPreviewDialogData {
  items: IQrLabelData[];
  /** true = มาจากการ "สร้าง QR ใหม่" (regenerate) แสดงข้อความเตือนสติกเกอร์เดิมใช้ไม่ได้ */
  regenerated?: boolean;
}
