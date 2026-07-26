import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IconComponent } from '../icon/icon.component';
import type { IQrPrintPreviewDialogData } from './qr-print-preview.model';

/**
 * แสดงตัวอย่างสติกเกอร์ QR ก่อนพิมพ์จริง (รองรับทั้งรายการเดียวและหลายรายการ/Bulk Print)
 * ปุ่มทุกปุ่มเชื่อมโยงกับหน้า/การกระทำจริง: พิมพ์ (window.print แบบ isolate เฉพาะพื้นที่ label),
 * คัดลอกลิงก์สแกน, เปิดลิงก์ทดสอบว่าตรงหน้าที่กำหนดจริง, และไปหน้ารายละเอียดครุภัณฑ์
 */
@Component({
  selector: 'khd-qr-print-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatTooltipModule, IconComponent],
  templateUrl: './qr-print-preview.component.html',
  styleUrl: './qr-print-preview.component.scss',
})
export class QrPrintPreviewComponent {
  private readonly router = inject(Router);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  readonly dialogRef = inject(MatDialogRef<QrPrintPreviewComponent>);
  readonly data = inject<IQrPrintPreviewDialogData>(MAT_DIALOG_DATA);

  readonly copiedAssetId = signal<string | null>(null);

  print(): void {
    window.print();
  }

  copyLink(scanUrl: string, assetId: string): void {
    this.clipboard.copy(scanUrl);
    this.copiedAssetId.set(assetId);
    this.snackBar.open('คัดลอกลิงก์แล้ว', 'ปิด', { duration: 2000 });
    setTimeout(() => this.copiedAssetId.set(null), 2000);
  }

  openLink(scanUrl: string): void {
    window.open(scanUrl, '_blank', 'noopener');
  }

  goToAsset(assetId: string): void {
    this.dialogRef.close();
    void this.router.navigate(['/assets', assetId]);
  }

  close(): void {
    this.dialogRef.close();
  }
}
