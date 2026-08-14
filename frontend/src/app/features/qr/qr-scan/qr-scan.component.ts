import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
  private readonly router = inject(Router);

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

  goToLogin(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { returnUrl: `/qr/scan/${this.token()}` } });
  }

  submitTicket(): void {
    const asset = this.asset();
    if (!asset || this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.repairTicketService
      .create({ assetId: asset.id, ...this.form.getRawValue() } as ICreateTicketPayload)
      .subscribe({
        next: (ticket) => {
          this.submitting.set(false);
          this.createdTicketNumber.set(ticket.ticketNumber);
          this.showForm.set(false);
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }

  /** true ถ้าครุภัณฑ์นี้ว่าง (ไม่มีใครยืมอยู่) — แสดงปุ่ม "ยืมอุปกรณ์นี้" */
  canBorrow(a: IQrScanResult): boolean {
    return a.activeLoan === null;
  }

  /** true ถ้าผู้ใช้ปัจจุบันเป็นคนยืมครุภัณฑ์นี้อยู่ — แสดงปุ่ม "คืนอุปกรณ์นี้" */
  canReturn(a: IQrScanResult): boolean {
    return a.activeLoan !== null && a.activeLoan.borrowerId === this.authService.currentUser()?.id;
  }

  openLoanForm(): void {
    this.loanForm.reset({ purpose: '', expectedReturnDate: '', conditionOnBorrow: '', conditionOnReturn: '' });
    this.showLoanForm.set(true);
  }

  submitLoan(): void {
    const asset = this.asset();
    const userId = this.authService.currentUser()?.id;
    if (!asset || !userId || this.submittingLoan()) return;

    this.submittingLoan.set(true);
    const raw = this.loanForm.getRawValue();

    const request$ = this.canReturn(asset)
      ? this.assetLoanService.returnLoan(asset.activeLoan!.id, raw.conditionOnReturn || undefined)
      : this.assetLoanService.create({
          assetId: asset.id,
          borrowerId: userId,
          expectedReturnDate: raw.expectedReturnDate || undefined,
          purpose: raw.purpose || undefined,
          conditionOnBorrow: raw.conditionOnBorrow || undefined,
        });
    const action: LoanAction = this.canReturn(asset) ? 'return' : 'borrow';

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
