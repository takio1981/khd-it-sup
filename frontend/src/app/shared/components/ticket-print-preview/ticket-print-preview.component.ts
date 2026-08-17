import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IconComponent } from '../icon/icon.component';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { DocumentService } from '../../../core/services/document.service';
import { SettingsService } from '../../../core/services/settings.service';
import { downloadBlob } from '../../../core/utils/download.util';
import {
  EQUIPMENT_TYPE_LABEL_TH,
  INSPECTION_OUTCOME_LABEL_TH,
  URGENCY_LABEL_TH,
  getStatusLabel,
} from '../../../core/constants/status.const';
import { environment } from '../../../../environments/environment';
import type { IRepairTicketDetail } from '../../../core/models/repair-ticket.model';

const REPAIR_REQUEST_TEMPLATE_CODE = 'REPAIR_REQUEST';

/** หัวหน้ากลุ่มงานสุขภาพดิจิทัลตามแบบฟอร์มกระดาษต้นแบบ — พิมพ์ไว้ล่วงหน้าบนกระดาษเสมอเพราะตำแหน่งนี้มีผู้ครองตำแหน่งเดียว
 *  ใช้เป็นค่า default ก่อนมีการอนุมัติจริงในระบบ (หลังอนุมัติแล้วจะแสดงชื่อผู้อนุมัติจริงแทน) */
const DIGITAL_HEALTH_HEAD_DEFAULT_NAME = 'นายปกรณ์ ริมประนาม';
const DIGITAL_HEALTH_HEAD_POSITION = 'นักวิชาการสาธารณสุขชำนาญการ';

export interface ITicketPrintPreviewDialogData {
  ticket: IRepairTicketDetail;
}

interface IPrintImageAttachment {
  id: string;
  objectUrl: string;
}

interface IPrintVideoAttachment {
  id: string;
  filename: string;
}

const CHECKED = '☑';
const UNCHECKED = '☐';

/**
 * ตัวอย่างก่อนพิมพ์ "แบบฟอร์มการขอรับบริการซ่อมแซมคอมพิวเตอร์และอุปกรณ์" ตามแบบฟอร์มกระดาษต้นแบบของ
 * กลุ่มงานสุขภาพดิจิทัล — ใช้ print CSS isolation เดียวกับ QR label (#khd-print-area / .khd-no-print ใน styles.scss)
 * พิมพ์ผ่าน window.print() ของเบราว์เซอร์โดยตรง หรือส่งออกเป็นไฟล์ PDF ผ่าน exportPdf() (jsPDF + html2canvas ฝั่ง client,
 * บังคับ format: 'a4' เสมอ — ดู buildPdfBlob())
 */
@Component({
  selector: 'khd-ticket-print-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatDialogModule, MatButtonModule, IconComponent],
  templateUrl: './ticket-print-preview.component.html',
  styleUrl: './ticket-print-preview.component.scss',
})
export class TicketPrintPreviewComponent {
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly documentService = inject(DocumentService);
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly dialogRef = inject(MatDialogRef<TicketPrintPreviewComponent>);
  readonly data = inject<ITicketPrintPreviewDialogData>(MAT_DIALOG_DATA);

  readonly orgName = environment.orgNameTh;
  readonly groupName = 'กลุ่มงานสุขภาพดิจิทัล';
  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly equipmentTypeLabels = EQUIPMENT_TYPE_LABEL_TH;
  readonly outcomeLabels = INSPECTION_OUTCOME_LABEL_TH;
  readonly getStatusLabel = getStatusLabel;
  readonly digitalHealthHeadPosition = DIGITAL_HEALTH_HEAD_POSITION;

  readonly exporting = signal(false);
  readonly issuing = signal(false);
  readonly issuedRunningNumber = signal<string | null>(null);
  readonly imageAttachments = signal<IPrintImageAttachment[]>([]);
  readonly videoAttachments: IPrintVideoAttachment[] = this.data.ticket.attachments
    .filter((a) => a.fileType?.startsWith('video/'))
    .map((a) => ({ id: a.id, filename: a.fileUrl.split('/').pop() ?? a.fileUrl }));

  /** โลโก้หน่วยงานตามที่ตั้งค่าไว้ในระบบ (เมนู "ตั้งค่าทั่วไป") — fallback เป็น logo1.png เหมือน shell ถ้ายังไม่ได้ตั้งค่า */
  readonly logoObjectUrl = signal<string | null>(null);

  constructor() {
    const imageAtts = this.data.ticket.attachments.filter((a) => a.fileType?.startsWith('image/'));
    imageAtts.forEach((att) => {
      this.repairTicketService.getAttachmentBlob(att.fileUrl).subscribe((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.imageAttachments.update((list) => [...list, { id: att.id, objectUrl }]);
      });
    });

    this.settingsService.getBranding().subscribe((b) => {
      if (b.orgLogoUrl) {
        this.settingsService.getLogoBlob(b.orgLogoUrl).subscribe((blob) => this.logoObjectUrl.set(URL.createObjectURL(blob)));
      }
    });

    this.destroyRef.onDestroy(() => {
      this.imageAttachments().forEach((img) => URL.revokeObjectURL(img.objectUrl));
      const logoUrl = this.logoObjectUrl();
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    });
  }

  /** ชื่อจริง — แยกจาก fullName ด้วยช่องว่างตัวแรก (รูปแบบฟอร์มกระดาษแยกช่อง "ชื่อ"/"สกุล" ต่างหาก) */
  firstName(): string {
    const full = this.data.ticket.reportedBy.fullName.trim();
    const spaceIdx = full.indexOf(' ');
    return spaceIdx === -1 ? full : full.slice(0, spaceIdx);
  }

  /** นามสกุล — ส่วนที่เหลือหลังช่องว่างตัวแรกของ fullName */
  lastName(): string {
    const full = this.data.ticket.reportedBy.fullName.trim();
    const spaceIdx = full.indexOf(' ');
    return spaceIdx === -1 ? '-' : full.slice(spaceIdx + 1);
  }

  /** วันที่แบบไทย (ปี พ.ศ.) แยกเป็นวัน/เดือน/ปี เพื่อใส่คั่นด้วยคำว่า "เดือน"/"พ.ศ." ตามแบบฟอร์มกระดาษ
   *  หมายเหตุ: ปีคำนวณเองจาก getFullYear() + 543 แทนการใช้ Intl 'year' อย่างเดียว เพราะ locale th-TH-u-ca-buddhist
   *  จะแปะคำว่า "พ.ศ." ต่อท้ายตัวเลขปีให้เองอัตโนมัติ ทำให้ซ้ำกับคำว่า "พ.ศ." ที่เขียนไว้ในเทมเพลตแล้ว */
  thaiDateParts(iso: string | null): { day: string; month: string; year: string } {
    if (!iso) return { day: '-', month: '-', year: '-' };
    const date = new Date(iso);
    return {
      day: date.toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric' }),
      month: date.toLocaleDateString('th-TH-u-ca-buddhist', { month: 'long' }),
      year: String(date.getFullYear() + 543),
    };
  }

  thaiDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  check(checked: boolean): string {
    return checked ? CHECKED : UNCHECKED;
  }

  /** ชื่อหัวหน้ากลุ่มงานสุขภาพดิจิทัล — แสดงชื่อผู้อนุมัติจริงถ้ามีการอนุมัติแล้ว ไม่งั้น fallback เป็นชื่อที่พิมพ์ไว้บนกระดาษต้นแบบ */
  digitalHealthHeadName(): string {
    const approver = this.data.ticket.digitalHealthHeadApprovedBy;
    return approver ? approver.fullName : DIGITAL_HEALTH_HEAD_DEFAULT_NAME;
  }

  print(): void {
    window.print();
  }

  /** สร้าง PDF จาก #khd-print-area (jsPDF + html2canvas) — คืนเป็น Blob เพื่อให้ทั้ง save เองและอัปโหลดขึ้น backend ได้
   *  ใช้ JPEG ไม่ใช่ PNG เพราะตัวอักษร anti-aliased ทำให้ PNG บีบอัดได้แย่มาก (ไฟล์บวมเป็นสิบ MB) */
  private async buildPdfBlob(): Promise<Blob | null> {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
    const target = document.getElementById('khd-print-area');
    if (!target) return null;

    const canvas = await html2canvas(target, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

    return pdf.output('blob');
  }

  /** ส่งออก PDF เก็บไว้ดูเองเฉยๆ — ไม่ออกเลขที่เอกสารทางการ (ใช้พรีวิวซ้ำได้หลายครั้งโดยไม่เปลืองเลขที่วิ่ง) */
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

  /** ออกเลขที่เอกสารทางการจริง (running_number_sequences) แล้วบันทึกเป็นหลักฐานถาวรใน generated_documents ก่อนดาวน์โหลด */
  async issueAndSave(): Promise<void> {
    if (this.issuing()) return;
    this.issuing.set(true);
    try {
      const blob = await this.buildPdfBlob();
      if (!blob) return;

      const filename = `ใบแจ้งซ่อม-${this.data.ticket.ticketNumber}.pdf`;
      this.documentService.generate(REPAIR_REQUEST_TEMPLATE_CODE, blob, filename, this.data.ticket.id).subscribe({
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
