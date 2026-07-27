import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { IconComponent } from '../icon/icon.component';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import {
  EQUIPMENT_TYPE_LABEL_TH,
  INSPECTION_OUTCOME_LABEL_TH,
  URGENCY_LABEL_TH,
  getStatusLabel,
} from '../../../core/constants/status.const';
import { environment } from '../../../../environments/environment';
import type { IRepairTicketDetail } from '../../../core/models/repair-ticket.model';

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
 * พิมพ์ผ่าน window.print() ของเบราว์เซอร์โดยตรง หรือส่งออกเป็นไฟล์ PDF ผ่าน exportPdf() (jsPDF + html2canvas ฝั่ง client)
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
  private readonly destroyRef = inject(DestroyRef);
  readonly dialogRef = inject(MatDialogRef<TicketPrintPreviewComponent>);
  readonly data = inject<ITicketPrintPreviewDialogData>(MAT_DIALOG_DATA);

  readonly orgName = environment.orgNameTh;
  readonly groupName = 'กลุ่มงานสุขภาพดิจิทัล';
  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly equipmentTypeLabels = EQUIPMENT_TYPE_LABEL_TH;
  readonly outcomeLabels = INSPECTION_OUTCOME_LABEL_TH;
  readonly getStatusLabel = getStatusLabel;

  readonly exporting = signal(false);
  readonly imageAttachments = signal<IPrintImageAttachment[]>([]);
  readonly videoAttachments: IPrintVideoAttachment[] = this.data.ticket.attachments
    .filter((a) => a.fileType?.startsWith('video/'))
    .map((a) => ({ id: a.id, filename: a.fileUrl.split('/').pop() ?? a.fileUrl }));

  constructor() {
    const imageAtts = this.data.ticket.attachments.filter((a) => a.fileType?.startsWith('image/'));
    imageAtts.forEach((att) => {
      this.repairTicketService.getAttachmentBlob(att.fileUrl).subscribe((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.imageAttachments.update((list) => [...list, { id: att.id, objectUrl }]);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.imageAttachments().forEach((img) => URL.revokeObjectURL(img.objectUrl));
    });
  }

  /** วันที่แบบไทย (ปี พ.ศ.) ผ่าน Intl calendar ตรง ๆ โดยไม่ต้องลงทะเบียน locale th ใน Angular */
  thaiDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  check(checked: boolean): string {
    return checked ? CHECKED : UNCHECKED;
  }

  print(): void {
    window.print();
  }

  async exportPdf(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
      const target = document.getElementById('khd-print-area');
      if (!target) return;

      const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`ใบแจ้งซ่อม-${this.data.ticket.ticketNumber}.pdf`);
    } finally {
      this.exporting.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
