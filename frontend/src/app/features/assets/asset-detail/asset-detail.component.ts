import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../../core/services/auth.service';
import { AssetService } from '../../../core/services/asset.service';
import { QrCodeService } from '../../../core/services/qrcode.service';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { QrPrintPreviewComponent } from '../../../shared/components/qr-print-preview/qr-print-preview.component';
import { AssetPhotoThumbnailComponent } from '../../../shared/components/asset-photo-thumbnail/asset-photo-thumbnail.component';
import type { IQrLabelData } from '../../../shared/components/qr-print-preview/qr-print-preview.model';
import { AssetFormComponent } from '../asset-form/asset-form.component';
import { downloadBlob } from '../../../core/utils/download.util';
import { getAcquisitionTypeLabel } from '../../../core/constants/status.const';
import { getCategoryIconName } from '../../../core/utils/category-icon.util';
import type { IAsset, IAssetCategory, IAssetHistoryItem } from '../../../core/models/asset.model';

@Component({
  selector: 'khd-asset-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    StatusBadgeComponent,
    IconComponent,
    HasPermissionDirective,
    AssetPhotoThumbnailComponent,
  ],
  templateUrl: './asset-detail.component.html',
})
export class AssetDetailComponent implements OnDestroy {
  private readonly assetService = inject(AssetService);
  private readonly qrCodeService = inject(QrCodeService);
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  private static readonly MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;

  /** ผูกอัตโนมัติจาก route param :id */
  readonly id = input<string>('');

  readonly asset = signal<IAsset | null>(null);
  readonly history = signal<IAssetHistoryItem[]>([]);
  readonly loading = signal(true);
  readonly qrDataUrl = signal<string | null>(null);
  readonly printing = signal(false);
  readonly uploadingPhotos = signal(false);
  readonly categories = signal<IAssetCategory[]>([]);
  readonly exportingHistory = signal(false);

  constructor() {
    this.assetService.getCategories().subscribe((cats) => this.categories.set(cats));

    // effect() แทนการเรียก load() ตรง ๆ — withComponentInputBinding() ตั้งค่า id หลัง constructor ทำงาน
    effect(() => {
      if (this.id()) this.load();
    });
  }

  acquisitionTypeLabel(code: string): string {
    return getAcquisitionTypeLabel(code);
  }

  /** ไม่มีรูปภาพบันทึกไว้ — ใช้ icon ของประเภทครุภัณฑ์นั้นแทน */
  categoryIconName(asset: IAsset): string {
    return getCategoryIconName(asset.category.icon);
  }

  openEditForm(): void {
    const asset = this.asset();
    if (!asset) return;
    const ref = this.dialog.open(AssetFormComponent, { width: '520px', data: { asset, categories: this.categories() } });
    ref.afterClosed().subscribe((result) => result && this.load());
  }

  deleteAsset(): void {
    const asset = this.asset();
    if (!asset) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: { title: 'ลบครุภัณฑ์', message: `ยืนยันการลบครุภัณฑ์ ${asset.assetNumber} ใช่หรือไม่?`, danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.assetService.remove(asset.id).subscribe(() => void this.router.navigate(['/assets']));
      }
    });
  }

  private load(): void {
    const id = this.id();
    if (!id) return;

    this.loading.set(true);
    this.assetService.getById(id).subscribe((asset) => {
      this.asset.set(asset);
      this.loading.set(false);
    });
    this.assetService.getHistory(id).subscribe((history) => this.history.set(history));
    this.loadQrImage(id);
  }

  /** โหลด QR มาแสดงอัตโนมัติเสมอ — ไม่ต้องกด "สร้าง QR" อีกต่อไป endpoint นี้สร้างให้เองถ้ายังไม่เคยมี และไม่ regenerate ทับของเดิม */
  private loadQrImage(assetId: string): void {
    if (!this.authService.hasAnyPermission(['qrcode:print'])) return;
    this.qrCodeService.printPng(assetId).subscribe({
      next: (blob) => {
        const previous = this.qrDataUrl();
        if (previous) URL.revokeObjectURL(previous);
        this.qrDataUrl.set(URL.createObjectURL(blob));
      },
      error: () => this.qrDataUrl.set(null),
    });
  }

  /** แสดงตัวอย่างก่อนพิมพ์ — ใช้ QR เดิมถ้ามีอยู่แล้ว (ไม่ regenerate) */
  printQr(): void {
    const asset = this.asset();
    if (!asset) return;

    this.printing.set(true);
    this.qrCodeService.printPng(asset.id).subscribe({
      next: (blob) => {
        this.assetService.getById(asset.id).subscribe((fresh) => {
          this.printing.set(false);
          this.asset.set(fresh);
          const imageSrc = URL.createObjectURL(blob);
          const scanUrl = fresh.qrcode ? this.qrCodeService.buildScanUrl(fresh.qrcode.qrToken) : '';
          const item: IQrLabelData = {
            assetId: fresh.id,
            assetNumber: fresh.assetNumber,
            categoryNameTh: fresh.category.nameTh,
            brand: fresh.brand,
            model: fresh.model,
            govAssetNumber: fresh.govAssetNumber,
            departmentNameTh: fresh.department?.nameTh ?? null,
            imageSrc,
            scanUrl,
          };
          this.dialog.open(QrPrintPreviewComponent, { width: '900px', maxWidth: '95vw', data: { items: [item] } });
        });
      },
      error: () => this.printing.set(false),
    });
  }

  ngOnDestroy(): void {
    const url = this.qrDataUrl();
    if (url) URL.revokeObjectURL(url);
  }

  canEditPhotos(): boolean {
    return this.authService.hasAnyPermission(['asset:update']);
  }

  triggerPhotoInput(): void {
    this.photoInput?.nativeElement.click();
  }

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const fileList = Array.from(files);
    const tooLarge = fileList.find((f) => f.size > AssetDetailComponent.MAX_PHOTO_SIZE_BYTES);
    if (tooLarge) {
      this.snackBar.open(`ไฟล์ "${tooLarge.name}" มีขนาดเกิน 5 MB`, 'ปิด', { duration: 4000 });
      input.value = '';
      return;
    }

    this.uploadingPhotos.set(true);
    this.assetService.uploadPhotos(this.id(), fileList).subscribe({
      next: () => {
        this.uploadingPhotos.set(false);
        input.value = '';
        this.load();
      },
      error: () => {
        this.uploadingPhotos.set(false);
        this.snackBar.open('อัปโหลดรูปภาพไม่สำเร็จ', 'ปิด', { duration: 3000 });
        input.value = '';
      },
    });
  }

  deletePhoto(photoId: string): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '360px',
      data: { title: 'ลบรูปครุภัณฑ์', message: 'ยืนยันการลบรูปนี้ใช่หรือไม่?', danger: true },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.assetService.removePhoto(this.id(), photoId).subscribe(() => this.load());
    });
  }

  exportHistoryExcel(): void {
    this.exportHistory('xlsx');
  }

  exportHistoryCsv(): void {
    this.exportHistory('csv');
  }

  private exportHistory(format: 'xlsx' | 'csv'): void {
    if (this.exportingHistory()) return;
    const asset = this.asset();
    if (!asset) return;

    this.exportingHistory.set(true);
    this.repairTicketService.exportFile({ assetId: asset.id }, format).subscribe({
      next: (blob) => {
        downloadBlob(blob, `repair-history-${asset.assetNumber}-${Date.now()}.${format}`);
        this.exportingHistory.set(false);
      },
      error: () => {
        this.exportingHistory.set(false);
        this.snackBar.open('Export ประวัติการซ่อมไม่สำเร็จ', 'ปิด', { duration: 3000 });
      },
    });
  }
}
