import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AssetService } from '../../../core/services/asset.service';
import { IconComponent } from '../icon/icon.component';
import { AttachmentLightboxComponent } from '../attachment-lightbox/attachment-lightbox.component';

/** Thumbnail รูปครุภัณฑ์ — โหลดผ่าน blob (ต้องแนบ Authorization header) คลิกเพื่อดูขนาดเต็ม, ลบได้ถ้า deletable */
@Component({
  selector: 'khd-asset-photo-thumbnail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule, IconComponent],
  template: `
    <div class="relative h-24 w-24 shrink-0 group">
      <button
        type="button"
        class="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-800"
        (click)="open()"
        [disabled]="!objectUrl()"
      >
        @if (!objectUrl()) {
          <mat-spinner diameter="20" />
        } @else {
          <img [src]="objectUrl()" class="h-full w-full object-cover" alt="รูปครุภัณฑ์" />
        }
      </button>
      @if (deletable()) {
        <button
          type="button"
          class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          (click)="removed.emit()"
        >
          <khd-icon name="x-mark" [size]="12" />
        </button>
      }
    </div>
  `,
})
export class AssetPhotoThumbnailComponent {
  private readonly assetService = inject(AssetService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly fileUrl = input.required<string>();
  readonly deletable = input(false);
  readonly removed = output<void>();

  readonly objectUrl = signal<string | null>(null);

  constructor() {
    effect(() => {
      const url = this.fileUrl();
      this.objectUrl.set(null);
      this.assetService.getPhotoBlob(url).subscribe((blob) => this.objectUrl.set(URL.createObjectURL(blob)));
    });

    this.destroyRef.onDestroy(() => {
      const url = this.objectUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  open(): void {
    const url = this.objectUrl();
    if (!url) return;
    this.dialog.open(AttachmentLightboxComponent, { maxWidth: '95vw', data: { url, fileType: 'image/jpeg', isVideo: false } });
  }
}
