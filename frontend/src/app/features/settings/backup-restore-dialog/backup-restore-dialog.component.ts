import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BackupService } from '../../../core/services/backup.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { IBackupLog } from '../../../core/models/backup.model';

export interface IBackupRestoreDialogData {
  log: IBackupLog;
}

/**
 * ยืนยันการกู้คืนข้อมูล — ปฏิบัติการทำลายข้อมูลปัจจุบันได้จริง จึงบังคับ 2 ชั้น: กรอกรหัสผ่านของตัวเองซ้ำ
 * (กันเครื่องที่ล็อกอินค้างไว้แล้วมีคนอื่นมากดแทน) + พิมพ์ชื่อไฟล์ให้ตรงเป๊ะ (บังคับให้อ่านก่อนกด ไม่ใช่กด
 * ยืนยันลอยๆ) ปุ่มยืนยัน disable จนกรอกครบทั้งสองช่อง — backend จะสำรองข้อมูลนิรภัย (SAFETY) แบบเต็มให้ก่อน
 * restore เสมอโดยอัตโนมัติ (ไม่มีทางปิดจาก UI ได้เลย)
 */
@Component({
  selector: 'khd-backup-restore-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, IconComponent],
  template: `
    <h2 mat-dialog-title class="!flex !items-center !gap-2 !text-rose-600 dark:!text-rose-400">
      <khd-icon name="exclamation-triangle" [size]="20" />
      ยืนยันการกู้คืนข้อมูล
    </h2>
    <mat-dialog-content class="!space-y-4">
      <div class="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-sm text-rose-700 dark:text-rose-300">
        การกระทำนี้จะแทนที่ข้อมูล{{ data.log.scope === 'FULL' ? 'ทั้งหมด' : 'ในตารางที่เกี่ยวข้อง' }}ในระบบด้วยข้อมูลจากไฟล์สำรองที่เลือก
        <strong>ไม่สามารถย้อนกลับได้ทันที</strong> — ระบบจะสำรองข้อมูลนิรภัย (SAFETY) แบบเต็มให้อัตโนมัติก่อนเริ่มกู้คืนเสมอ
      </div>

      <div class="text-sm space-y-1">
        <div class="flex justify-between"><span class="text-neutral-500">ไฟล์</span><span class="font-medium">{{ data.log.fileName }}</span></div>
        <div class="flex justify-between"><span class="text-neutral-500">ขอบเขต</span><span>{{ data.log.scope === 'FULL' ? 'ทั้งหมด' : 'เฉพาะบางตาราง' }}</span></div>
        @if (data.log.scope === 'PARTIAL' && data.log.includedTables) {
          <div class="text-xs text-neutral-400 text-right">{{ data.log.includedTables.join(', ') }}</div>
        }
      </div>

      <mat-form-field appearance="outline" class="w-full !mb-[-1.25em]">
        <mat-label>รหัสผ่านของคุณ (ยืนยันตัวตนอีกครั้ง)</mat-label>
        <input matInput type="password" [(ngModel)]="confirmPassword" [disabled]="submitting()" autocomplete="current-password" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="w-full !mb-[-1.25em]">
        <mat-label>พิมพ์ชื่อไฟล์ "{{ data.log.fileName }}" เพื่อยืนยัน</mat-label>
        <input matInput [(ngModel)]="confirmFileName" [disabled]="submitting()" autocomplete="off" />
      </mat-form-field>

      @if (errorMessage(); as err) {
        <p class="text-xs text-rose-600 dark:text-rose-400">{{ err }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [disabled]="submitting()" mat-dialog-close>ยกเลิก</button>
      <button mat-flat-button color="warn" [disabled]="!canSubmit() || submitting()" (click)="submit()">
        @if (submitting()) {
          <mat-spinner diameter="16" class="!inline-block !mr-1" />
        }
        ยืนยันกู้คืนข้อมูล
      </button>
    </mat-dialog-actions>
  `,
})
export class BackupRestoreDialogComponent {
  readonly data = inject<IBackupRestoreDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<BackupRestoreDialogComponent>);
  private readonly backupService = inject(BackupService);

  confirmPassword = '';
  confirmFileName = '';

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  canSubmit(): boolean {
    return this.confirmPassword.trim().length > 0 && this.confirmFileName.trim().length > 0;
  }

  submit(): void {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.backupService.restore(this.data.log.id, { confirmPassword: this.confirmPassword, confirmFileName: this.confirmFileName }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.error?.message ?? 'เริ่มกู้คืนข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      },
    });
  }
}
