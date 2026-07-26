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
import { AuthService } from '../../../core/services/auth.service';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { URGENCY_LABEL_TH } from '../../../core/constants/status.const';
import type { ICreateTicketPayload } from '../../../core/models/repair-ticket.model';

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
  ],
  templateUrl: './qr-scan.component.html',
})
export class QrScanComponent {
  private readonly qrCodeService = inject(QrCodeService);
  private readonly repairTicketService = inject(RepairTicketService);
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
}
