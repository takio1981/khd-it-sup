import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IconComponent } from '../icon/icon.component';
import { DocumentService } from '../../../core/services/document.service';
import { SettingsService } from '../../../core/services/settings.service';
import { downloadBlob } from '../../../core/utils/download.util';
import { environment } from '../../../../environments/environment';
import type { IRepairTicketDetail } from '../../../core/models/repair-ticket.model';

const REPAIR_REQUEST_GENERAL_TEMPLATE_CODE = 'REPAIR_REQUEST_GENERAL';

/** ตำแหน่งที่พิมพ์ไว้ล่วงหน้าบนกระดาษต้นแบบ "ใบแจ้งซ่อม ช่างซ่อม" (ส่วนที่ 2) — คนละตำแหน่งกับ
 *  หัวหน้ากลุ่มงานสุขภาพดิจิทัลของแบบฟอร์มคอมพิวเตอร์ เพราะฟอร์มนี้ผ่านสายงานพัสดุ ก่อสร้างและซ่อมบำรุงแทน */
const SUPPLY_HEAD_NAME = 'นางอมรรัตน์ ทรงดอน';
const SUPPLY_HEAD_POSITION = 'นักวิชาการพัสดุปฏิบัติการ หัวหน้างานพัสดุ ก่อสร้างและการซ่อมบำรุง';
const GENERAL_ADMIN_HEAD_NAME = 'นางสาวชนกพร ผลทรัพย์';
const GENERAL_ADMIN_HEAD_POSITION = 'นักจัดการงานทั่วไปชำนาญการพิเศษ หัวหน้ากลุ่มงานบริหารทั่วไป';

/** ประเภทงานตามช่องกาเครื่องหมายบนกระดาษต้นแบบ — เดาได้จากหมวดหมู่ครุภัณฑ์แค่ "ระบบปรับอากาศ" เท่านั้น
 *  (ตรงกับ category code AC ตัวเดียว) ที่เหลือปล่อยว่างให้ผู้แจ้ง/เจ้าหน้าที่กาด้วยมือ เพราะไม่มีข้อมูลที่เชื่อถือได้พอจะเดาแทน */
const WORK_TYPES: { label: string; matchesAc?: boolean }[] = [
  { label: 'ระบบไฟฟ้า' },
  { label: 'ระบบสุขาภิบาล' },
  { label: 'ระบบสื่อสาร' },
  { label: 'ระบบประปา' },
  { label: 'ระบบปรับอากาศ', matchesAc: true },
  { label: 'งานอาคาร' },
  { label: 'ครุภัณฑ์' },
];

export interface ITicketPrintPreviewGeneralDialogData {
  ticket: IRepairTicketDetail;
}

const CHECKED = '☑';
const UNCHECKED = '☐';

/**
 * ตัวอย่างก่อนพิมพ์ "ใบแจ้งซ่อม" (แบบฟอร์มทั่วไป — งานระบบไฟฟ้า/สุขาภิบาล/สื่อสาร/ประปา/ปรับอากาศ/งานอาคาร/ครุภัณฑ์อื่นๆ
 * ที่ไม่ใช่คอมพิวเตอร์) ตามแบบฟอร์มกระดาษต้นแบบ "แบบฟอร์มแจ้งซ่อม ช่างซ่อม.pdf" ของงานพัสดุ ก่อสร้างและการซ่อมบำรุง
 * — คู่ขนานกับ TicketPrintPreviewComponent (แบบฟอร์มคอมพิวเตอร์/อุปกรณ์คอมพิวเตอร์) ที่มีอยู่เดิม ใช้กลไก PDF/print เดียวกันทุกจุด
 */
@Component({
  selector: 'khd-ticket-print-preview-general',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, IconComponent],
  templateUrl: './ticket-print-preview-general.component.html',
  styleUrl: './ticket-print-preview-general.component.scss',
})
export class TicketPrintPreviewGeneralComponent {
  private readonly documentService = inject(DocumentService);
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly dialogRef = inject(MatDialogRef<TicketPrintPreviewGeneralComponent>);
  readonly data = inject<ITicketPrintPreviewGeneralDialogData>(MAT_DIALOG_DATA);

  readonly orgName = environment.orgNameTh;
  readonly workTypes = WORK_TYPES;
  readonly supplyHeadName = SUPPLY_HEAD_NAME;
  readonly supplyHeadPosition = SUPPLY_HEAD_POSITION;
  readonly generalAdminHeadName = GENERAL_ADMIN_HEAD_NAME;
  readonly generalAdminHeadPosition = GENERAL_ADMIN_HEAD_POSITION;

  readonly exporting = signal(false);
  readonly issuing = signal(false);
  readonly issuedRunningNumber = signal<string | null>(null);

  /** โลโก้หน่วยงานตามที่ตั้งค่าไว้ในระบบ (เมนู "ตั้งค่าทั่วไป") — fallback เป็น logo1.png เหมือนแบบฟอร์มคอมพิวเตอร์ */
  readonly logoObjectUrl = signal<string | null>(null);

  constructor() {
    this.settingsService.getBranding().subscribe((b) => {
      if (b.orgLogoUrl) {
        this.settingsService.getLogoBlob(b.orgLogoUrl).subscribe((blob) => this.logoObjectUrl.set(URL.createObjectURL(blob)));
      }
    });

    this.destroyRef.onDestroy(() => {
      const logoUrl = this.logoObjectUrl();
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    });
  }

  /** วันที่แบบไทย (ปี พ.ศ.) แยกเป็นวัน/เดือน/ปี เพื่อใส่คั่นด้วยคำว่า "เดือน"/"พ.ศ." ตามแบบฟอร์มกระดาษ */
  thaiDateParts(iso: string | null): { day: string; month: string; year: string } {
    if (!iso) return { day: '-', month: '-', year: '-' };
    const date = new Date(iso);
    return {
      day: date.toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric' }),
      month: date.toLocaleDateString('th-TH-u-ca-buddhist', { month: 'long' }),
      year: String(date.getFullYear() + 543),
    };
  }

  check(checked: boolean): string {
    return checked ? CHECKED : UNCHECKED;
  }

  /** เดาช่องกา "ระบบปรับอากาศ" ได้อย่างเดียวจากหมวดหมู่ครุภัณฑ์ (category code = AC) ที่เหลือปล่อยว่างให้กาด้วยมือ
   *  เพราะไม่มีข้อมูลอื่นในระบบที่บ่งชี้ประเภทงานเหล่านี้ได้แม่นยำพอ (ป้องกันกาผิดในเอกสารราชการ) */
  isWorkTypeChecked(matchesAc?: boolean): boolean {
    if (!matchesAc) return false;
    return this.data.ticket.asset?.category?.code === 'AC';
  }

  print(): void {
    window.print();
  }

  /** สร้าง PDF จาก #khd-print-area (jsPDF + html2canvas) — เหมือนกับ TicketPrintPreviewComponent ทุกจุด
   *  (แบบฟอร์มนี้มีหน้าเดียว ไม่มีส่วน "สรุปผลการซ่อม" แยกหน้าเหมือนแบบฟอร์มคอมพิวเตอร์) */
  private async buildPdfBlob(): Promise<Blob | null> {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
    const mainTarget = document.getElementById('khd-print-main');
    if (!mainTarget) return null;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const canvas = await html2canvas(mainTarget, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
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

    return pdf.output('blob');
  }

  async exportPdf(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const blob = await this.buildPdfBlob();
      if (blob) downloadBlob(blob, `ใบแจ้งซ่อม-${this.data.ticket.ticketNumber}.pdf`);
    } finally {
      this.exporting.set(false);
    }
  }

  async issueAndSave(): Promise<void> {
    if (this.issuing()) return;
    this.issuing.set(true);
    try {
      const blob = await this.buildPdfBlob();
      if (!blob) return;

      const filename = `ใบแจ้งซ่อม-${this.data.ticket.ticketNumber}.pdf`;
      this.documentService.generate(REPAIR_REQUEST_GENERAL_TEMPLATE_CODE, blob, filename, this.data.ticket.id).subscribe({
        next: (doc) => {
          this.issuedRunningNumber.set(doc.runningNumber);
          this.issuing.set(false);
          this.snackBar.open(`ออกเลขที่เอกสาร ${doc.runningNumber} แล้ว`, 'ปิด', { duration: 4000 });
          downloadBlob(blob, filename);
        },
        error: () => {
          this.issuing.set(false);
          this.snackBar.open('ออกเลขที่เอกสารไม่สำเร็จ', 'ปิด', { duration: 3000 });
        },
      });
    } catch {
      this.issuing.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
