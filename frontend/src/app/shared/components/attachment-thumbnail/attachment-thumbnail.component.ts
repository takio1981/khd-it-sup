import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { AttachmentLightboxComponent } from '../attachment-lightbox/attachment-lightbox.component';

/** Thumbnail รูปภาพ/วิดีโอของไฟล์แนบใบแจ้งซ่อม — โหลดผ่าน blob (ต้องแนบ Authorization header) คลิกเพื่อดูขนาดเต็ม */
@Component({
  selector: 'khd-attachment-thumbnail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  template: `
    <button
      type="button"
      class="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800"
      (click)="open()"
      [disabled]="!objectUrl()"
    >
      @if (!objectUrl()) {
        <mat-spinner diameter="20" />
      } @else if (isVideo()) {
        <video [src]="objectUrl()" class="h-full w-full object-cover" muted></video>
        <span class="absolute inset-0 flex items-center justify-center bg-black/20">
          <svg viewBox="0 0 24 24" class="h-6 w-6 fill-white"><path d="M8 5v14l11-7z" /></svg>
        </span>
      } @else {
        <img [src]="objectUrl()" class="h-full w-full object-cover" alt="ไฟล์แนบ" />
      }
    </button>
  `,
})
export class AttachmentThumbnailComponent {
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly fileUrl = input.required<string>();
  readonly fileType = input<string | null>(null);

  /** timeline event.attachmentUrl ไม่มี fileType แนบมาด้วย — fallback เดาจากนามสกุลไฟล์ */
  readonly isVideo = computed(() => {
    const type = this.fileType();
    if (type) return type.startsWith('video/');
    return /\.(mp4|webm|mov|avi)$/i.test(this.fileUrl());
  });
  readonly objectUrl = signal<string | null>(null);

  constructor() {
    effect(() => {
      const url = this.fileUrl();
      this.objectUrl.set(null);
      this.repairTicketService.getAttachmentBlob(url).subscribe((blob) => this.objectUrl.set(URL.createObjectURL(blob)));
    });

    this.destroyRef.onDestroy(() => {
      const url = this.objectUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  open(): void {
    const url = this.objectUrl();
    if (!url) return;
    this.dialog.open(AttachmentLightboxComponent, {
      maxWidth: '95vw',
      data: { url, fileType: this.fileType(), isVideo: this.isVideo() },
    });
  }
}
