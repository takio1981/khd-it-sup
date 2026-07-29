import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';
import type { Gender } from '../../../core/models/auth.model';

/** ให้ผู้ใช้แต่ละคนอัปโหลดรูปโปรไฟล์และเลือกเพศของตนเอง (ใช้เลือกภาพ avatar เริ่มต้นเมื่อยังไม่มีรูป) */
@Component({
  selector: 'khd-profile-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatProgressSpinnerModule, UserAvatarComponent],
  template: `
    <h2 mat-dialog-title>รูปโปรไฟล์</h2>
    <mat-dialog-content class="!flex !flex-col !items-center !gap-4 !py-2">
      <khd-user-avatar [avatarUrl]="authService.currentUser()?.avatarUrl ?? null" [gender]="authService.currentUser()?.gender ?? null" [size]="96" />

      <div class="flex gap-2">
        <button mat-stroked-button type="button" [disabled]="uploading()" (click)="triggerInput()">
          @if (uploading()) {
            <mat-spinner diameter="16" class="!inline-block !mr-1" />
          }
          เปลี่ยนรูป
        </button>
        @if (authService.currentUser()?.avatarUrl) {
          <button mat-button type="button" color="warn" [disabled]="uploading()" (click)="removeAvatar()">ลบรูป</button>
        }
      </div>
      <input #fileInput type="file" accept="image/*" class="hidden" (change)="onFileSelected($event)" />

      <mat-form-field appearance="outline" class="w-full">
        <mat-label>เพศ (ใช้เลือกภาพ avatar เริ่มต้นเมื่อยังไม่มีรูป)</mat-label>
        <mat-select [(ngModel)]="selectedGender" [disabled]="savingGender()" (selectionChange)="saveGender()">
          <mat-option value="MALE">ชาย</mat-option>
          <mat-option value="FEMALE">หญิง</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>ปิด</button>
    </mat-dialog-actions>
  `,
})
export class ProfileDialogComponent {
  readonly authService = inject(AuthService);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly uploading = signal(false);
  readonly savingGender = signal(false);
  selectedGender: Gender | undefined = this.authService.currentUser()?.gender ?? undefined;

  triggerInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.authService.uploadMyAvatar(file).subscribe({
      next: () => {
        this.uploading.set(false);
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
      },
    });
  }

  removeAvatar(): void {
    this.uploading.set(true);
    this.authService.removeMyAvatar().subscribe({
      next: () => this.uploading.set(false),
      error: () => this.uploading.set(false),
    });
  }

  saveGender(): void {
    if (!this.selectedGender) return;
    this.savingGender.set(true);
    this.authService.updateMyGender(this.selectedGender).subscribe({
      next: () => this.savingGender.set(false),
      error: () => this.savingGender.set(false),
    });
  }
}
