import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { map, of, type Observable } from 'rxjs';
import { QrCodeService, type IQrScanResult } from '../../../core/services/qrcode.service';
import { RepairTicketService } from '../../../core/services/repair-ticket.service';
import { AssetLoanService } from '../../../core/services/asset-loan.service';
import { AuthService } from '../../../core/services/auth.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PageWatermarkComponent } from '../../../shared/components/page-watermark/page-watermark.component';
import { URGENCY_LABEL_TH } from '../../../core/constants/status.const';
import type { ICreateTicketPayload } from '../../../core/models/repair-ticket.model';

type LoanAction = 'borrow' | 'return';

/** ถามชื่อผู้ใช้/รหัสผ่านตอนกด "บันทึก" เท่านั้น (ไม่ต้อง login ก่อนถึงจะเห็นข้อมูล/ปุ่มเลือกทำรายการ) */
@Component({
  selector: 'khd-qr-login-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>เข้าสู่ระบบเพื่อยืนยัน</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="!flex !flex-col !gap-1">
        <p class="text-xs text-neutral-500 !mt-0 !mb-2">กรุณาเข้าสู่ระบบก่อนบันทึก{{ data.actionLabel }}</p>
        @if (error(); as e) {
          <p class="text-xs text-rose-600 !mb-2">{{ e }}</p>
        }
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>ชื่อผู้ใช้</mat-label>
          <input matInput formControlName="username" autocomplete="username" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>รหัสผ่าน</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="current-password" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>ยกเลิก</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading()">
          @if (loading()) {
            <mat-spinner diameter="18" class="!inline-block !mr-2" />
          }
          เข้าสู่ระบบ
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class QrLoginDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  readonly dialogRef = inject(MatDialogRef<QrLoginDialogComponent>);
  readonly data = inject<{ actionLabel: string }>(MAT_DIALOG_DATA);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้/รหัสผ่าน');
      },
    });
  }
}

@Component({
  selector: 'khd-qr-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    StatusBadgeComponent,
    IconComponent,
    PageWatermarkComponent,
  ],
  templateUrl: './qr-scan.component.html',
})
export class QrScanComponent {
  private readonly qrCodeService = inject(QrCodeService);
  private readonly repairTicketService = inject(RepairTicketService);
  private readonly assetLoanService = inject(AssetLoanService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly authService = inject(AuthService);
  readonly urgencyLabels = URGENCY_LABEL_TH;

  /** ผูกอัตโนมัติจาก route param :token (withComponentInputBinding) */
  readonly token = input<string>('');

  readonly asset = signal<IQrScanResult | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly submitting = signal(false);
  readonly createdTicketNumber = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    description: ['', Validators.required],
    urgency: ['MEDIUM', Validators.required],
    locationNote: [''],
    contactPhone: [''],
  });

  /** รูปครุภัณฑ์ที่บันทึกไว้ในระบบ — คลิกดูขยายได้ */
  readonly viewingPhotoUrl = signal<string | null>(null);

  /** รูปเครื่อง/อาการเสียที่แนบตอนแจ้งซ่อม — เลือกได้สูงสุด MAX_TICKET_PHOTOS ภาพ (บังคับซ้ำที่ backend ด้วย) */
  readonly MAX_TICKET_PHOTOS = 3;
  readonly ticketPhotos = signal<{ file: File; previewUrl: string }[]>([]);
  readonly photoError = signal<string | null>(null);

  /** ยืม-คืนอุปกรณ์ผ่านสแกน QR (self-service) — ตัดสินใจโหมด "ยืม"/"คืน" จาก activeLoan ของครุภัณฑ์ที่สแกนได้ */
  readonly showLoanForm = signal(false);
  readonly submittingLoan = signal(false);
  readonly loanActionDone = signal<LoanAction | null>(null);

  readonly loanForm = this.fb.nonNullable.group({
    purpose: [''],
    expectedReturnDate: [''],
    conditionOnBorrow: [''],
    conditionOnReturn: [''],
  });

  constructor() {
    effect(() => {
      const token = this.token();
      if (!token) return;

      this.loading.set(true);
      this.error.set(null);
      this.qrCodeService.resolve(token).subscribe({
        next: (result) => {
          this.asset.set(result);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.error?.message ?? 'ไม่พบข้อมูลครุภัณฑ์จาก QR Code นี้');
          this.loading.set(false);
        },
      });
    });
  }

  /** เปิด dialog ถามชื่อผู้ใช้/รหัสผ่านเฉพาะตอนยังไม่ login — เรียกตอนกดปุ่ม "บันทึก" เท่านั้น ไม่ใช่ตอนเปิดหน้า/เลือกฟอร์ม */
  private ensureAuthenticated(actionLabel: string): Observable<boolean> {
    if (this.authService.isAuthenticated()) return of(true);
    const ref = this.dialog.open(QrLoginDialogComponent, { width: '360px', disableClose: true, data: { actionLabel } });
    return ref.afterClosed().pipe(map((result) => result === true));
  }

  openTicketForm(): void {
    this.form.reset({ description: '', urgency: 'MEDIUM', locationNote: '', contactPhone: '' });
    this.clearTicketPhotos();
    this.showForm.set(true);
  }

  closeTicketForm(): void {
    this.clearTicketPhotos();
    this.showForm.set(false);
  }

  private clearTicketPhotos(): void {
    this.ticketPhotos().forEach((p) => URL.revokeObjectURL(p.previewUrl));
    this.ticketPhotos.set([]);
    this.photoError.set(null);
  }

  onTicketPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // เคลียร์ input เพื่อให้เลือกไฟล์เดิมซ้ำได้อีกครั้งถ้าลบออกไปแล้ว

    const remaining = this.MAX_TICKET_PHOTOS - this.ticketPhotos().length;
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    const accepted = imageFiles.slice(0, Math.max(0, remaining));

    if (imageFiles.length < files.length || accepted.length < imageFiles.length || remaining <= 0) {
      this.photoError.set(`แนบรูปได้สูงสุด ${this.MAX_TICKET_PHOTOS} ภาพ และรองรับเฉพาะไฟล์รูปภาพเท่านั้น`);
    } else {
      this.photoError.set(null);
    }

    const added = accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    this.ticketPhotos.update((list) => [...list, ...added]);
  }

  removeTicketPhoto(index: number): void {
    const list = this.ticketPhotos();
    URL.revokeObjectURL(list[index].previewUrl);
    this.ticketPhotos.set(list.filter((_, i) => i !== index));
    this.photoError.set(null);
  }

  submitTicket(): void {
    const asset = this.asset();
    if (!asset || this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.ensureAuthenticated('การแจ้งซ่อม').subscribe((ok) => {
      if (!ok) {
        this.submitting.set(false);
        return;
      }
      const files = this.ticketPhotos().map((p) => p.file);
      this.repairTicketService
        .create({ assetId: asset.id, ...this.form.getRawValue() } as ICreateTicketPayload, files)
        .subscribe({
          next: (ticket) => {
            this.submitting.set(false);
            this.createdTicketNumber.set(ticket.ticketNumber);
            this.closeTicketForm();
          },
          error: () => {
            this.submitting.set(false);
          },
        });
    });
  }

  /** true ถ้าครุภัณฑ์นี้ว่าง (ไม่มีใครยืมอยู่) — ตัดสิน "ยืม" หรือ "คืน" จากสถานะเครื่องเท่านั้น ไม่ต้องรู้ตัวตนผู้ดูก่อน login */
  isBorrowMode(a: IQrScanResult): boolean {
    return a.activeLoan === null;
  }

  openLoanForm(): void {
    this.loanForm.reset({ purpose: '', expectedReturnDate: '', conditionOnBorrow: '', conditionOnReturn: '' });
    this.showLoanForm.set(true);
  }

  submitLoan(): void {
    const asset = this.asset();
    if (!asset || this.submittingLoan()) return;

    const isBorrow = this.isBorrowMode(asset);
    this.submittingLoan.set(true);
    this.ensureAuthenticated(isBorrow ? 'การยืมอุปกรณ์' : 'การคืนอุปกรณ์').subscribe((ok) => {
      if (!ok) {
        this.submittingLoan.set(false);
        return;
      }
      this.doSubmitLoan(asset, isBorrow);
    });
  }

  private doSubmitLoan(asset: IQrScanResult, isBorrow: boolean): void {
    const raw = this.loanForm.getRawValue();
    const userId = this.authService.currentUser()!.id;

    const request$ = isBorrow
      ? this.assetLoanService.create({
          assetId: asset.id,
          borrowerId: userId,
          expectedReturnDate: raw.expectedReturnDate || undefined,
          purpose: raw.purpose || undefined,
          conditionOnBorrow: raw.conditionOnBorrow || undefined,
        })
      : this.assetLoanService.returnLoan(asset.activeLoan!.id, raw.conditionOnReturn || undefined);
    const action: LoanAction = isBorrow ? 'borrow' : 'return';

    request$.subscribe({
      next: () => {
        this.submittingLoan.set(false);
        this.loanActionDone.set(action);
        this.showLoanForm.set(false);
        // รีโหลดข้อมูลครุภัณฑ์เพื่อให้ activeLoan อัปเดตตามสถานะล่าสุด (ยืมแล้ว → ปุ่มเปลี่ยนเป็น "คืน" ทันทีถ้าสแกนซ้ำ)
        this.qrCodeService.resolve(this.token()).subscribe((result) => this.asset.set(result));
      },
      error: () => {
        this.submittingLoan.set(false);
      },
    });
  }
}
