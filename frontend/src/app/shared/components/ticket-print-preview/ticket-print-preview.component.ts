import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { IconComponent } from '../icon/icon.component';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { URGENCY_LABEL_TH, getStatusLabel } from '../../../core/constants/status.const';
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

/**
 * ตัวอย่างก่อนพิมพ์ "ใบแจ้งซ่อมครุภัณฑ์คอมพิวเตอร์" ตามแบบฟอร์มราชการทั่วไป —
 * ใช้ print CSS isolation เดียวกับ QR label (#khd-print-area / .khd-no-print ใน styles.scss)
 * พิมพ์ผ่าน window.print() ของเบราว์เซอร์โดยตรง ไม่มีการ generate ไฟล์ PDF ฝั่ง server
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
  readonly urgencyLabels = URGENCY_LABEL_TH;
  readonly getStatusLabel = getStatusLabel;

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

  print(): void {
    window.print();
  }

  close(): void {
    this.dialogRef.close();
  }
}
