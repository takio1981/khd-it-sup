import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { AssetService } from '../../../core/services/asset.service';
import { QrCodeService } from '../../../core/services/qrcode.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { QrPrintPreviewComponent } from '../../../shared/components/qr-print-preview/qr-print-preview.component';
import type { IQrLabelData } from '../../../shared/components/qr-print-preview/qr-print-preview.model';
import { AssetFormComponent } from '../asset-form/asset-form.component';
import type { IAsset, IAssetCategory, IAssetHistoryItem } from '../../../core/models/asset.model';

@Component({
  selector: 'khd-asset-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MatButtonModule, MatProgressSpinnerModule, StatusBadgeComponent, IconComponent, HasPermissionDirective],
  templateUrl: './asset-detail.component.html',
})
export class AssetDetailComponent {
  private readonly assetService = inject(AssetService);
  private readonly qrCodeService = inject(QrCodeService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /** ผูกอัตโนมัติจาก route param :id */
  readonly id = input<string>('');

  readonly asset = signal<IAsset | null>(null);
  readonly history = signal<IAssetHistoryItem[]>([]);
  readonly loading = signal(true);
  readonly qrDataUrl = signal<string | null>(null);
  readonly printing = signal(false);
  readonly categories = signal<IAssetCategory[]>([]);

  constructor() {
    this.assetService.getCategories().subscribe((cats) => this.categories.set(cats));

    // effect() แทนการเรียก load() ตรง ๆ — withComponentInputBinding() ตั้งค่า id หลัง constructor ทำงาน
    effect(() => {
      if (this.id()) this.load();
    });
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
  }

  /** สร้าง QR ใหม่ (regenerate) — เตือนก่อนเสมอถ้ามี QR อยู่แล้ว เพราะสติกเกอร์เดิมจะใช้ไม่ได้ทันที */
  generateQr(): void {
    const asset = this.asset();
    if (!asset) return;

    if (asset.qrcode) {
      const ref = this.dialog.open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'สร้าง QR Code ใหม่',
          message: `ครุภัณฑ์นี้มี QR Code อยู่แล้ว การสร้างใหม่จะทำให้สติกเกอร์เดิมที่เคยพิมพ์ไปแล้วสแกนไม่ได้อีกต่อไป ยืนยันหรือไม่?`,
          danger: true,
          confirmLabel: 'สร้างใหม่',
        },
      });
      ref.afterClosed().subscribe((confirmed) => {
        if (confirmed) this.doGenerate();
      });
    } else {
      this.doGenerate();
    }
  }

  private doGenerate(): void {
    this.qrCodeService.generate(this.id()).subscribe((result) => {
      this.qrDataUrl.set(result.dataUrl);
      this.load();
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
}
