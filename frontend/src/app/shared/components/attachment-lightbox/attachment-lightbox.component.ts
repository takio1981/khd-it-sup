import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IconComponent } from '../icon/icon.component';

export interface IAttachmentLightboxDialogData {
  url: string;
  fileType: string | null;
  isVideo: boolean;
}

/** แสดงรูปภาพ/วิดีโอไฟล์แนบขนาดเต็มจากไฟล์แนบใบแจ้งซ่อม */
@Component({
  selector: 'khd-attachment-lightbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatTooltipModule, IconComponent],
  template: `
    <div class="flex items-center justify-end p-1">
      <button mat-icon-button (click)="dialogRef.close()" matTooltip="ปิด">
        <khd-icon name="x-mark" [size]="20" />
      </button>
    </div>
    <mat-dialog-content class="!flex !items-center !justify-center !max-h-[80vh] !pt-0">
      @if (data.isVideo) {
        <video [src]="data.url" controls autoplay class="max-h-[75vh] max-w-full rounded-lg"></video>
      } @else {
        <img [src]="data.url" class="max-h-[75vh] max-w-full rounded-lg object-contain" alt="ไฟล์แนบ" />
      }
    </mat-dialog-content>
  `,
})
export class AttachmentLightboxComponent {
  readonly dialogRef = inject(MatDialogRef<AttachmentLightboxComponent>);
  readonly data = inject<IAttachmentLightboxDialogData>(MAT_DIALOG_DATA);
}
